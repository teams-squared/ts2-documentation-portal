import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/roles";
import { appRoleToPrisma } from "@/lib/types";
import type { Role } from "@/lib/types";
import { createEnrollments } from "@/lib/enrollments";
import { sendUserInviteEmail } from "@/lib/email";
import { normalizeInviteEmail } from "@/lib/inviteEmail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES: Role[] = ["admin", "course_manager", "employee"];

interface InviteBody {
  email?: string;
  name?: string | null;
  role?: Role;
  courseIds?: string[];
  /**
   * If true, re-send the invite email for an already-invited user and update
   * role/courses as requested. Without this flag, a row that looks like a real
   * prior invite returns 409 with `code: "already_invited"` so the UI can
   * prompt the admin to confirm a resend.
   */
  resend?: boolean;
}

/**
 * POST /api/admin/users/invite
 *
 * Pre-creates a user row and optionally pre-enrolls them into courses, then
 * dispatches an invite email. When the invited user later signs in via SSO,
 * the jwt-callback upsert in src/lib/auth.ts merges into the same row by
 * email — so pre-assigned enrollments are waiting on their first login.
 *
 * Idempotency: if a user row already exists for the email, we branch on
 * whether it looks like a prior invite (has `invitedAt`) or a passive
 * SSO-upsert ghost (no `invitedAt`, created when someone with that email hit
 * the auth callback — e.g. after a hard-delete + their session refreshed).
 *
 *  - SSO ghost (no `invitedAt`): silently adopt the row, treat as a fresh
 *    invite — update role/invitedAt/invitedById, run enrollments, send email.
 *  - Real prior invite (`invitedAt != null`): return 409 with
 *    `code: "already_invited"` unless the caller passes `resend: true`, in
 *    which case we refresh the invite metadata and re-send the email.
 *
 * Admin-only for inviting `admin` or `course_manager` users; course_manager
 * can invite `employee` users only.
 */
export async function POST(request: Request) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;
  const { userId: inviterId, role: inviterRole } = authResult;

  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Bare usernames (no "@") get the org domain appended, so `akil` becomes
  // `akil@teamsquared.io` while `akil@gmail.com` passes through unchanged.
  const email = normalizeInviteEmail(body.email ?? "");
  const name = body.name?.trim() || null;
  const role = body.role ?? "employee";
  const courseIds = Array.isArray(body.courseIds) ? body.courseIds : [];
  const resendRequested = body.resend === true;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (role !== "employee" && inviterRole !== "admin") {
    return NextResponse.json(
      { error: "Only admins can invite admins or course managers" },
      { status: 403 },
    );
  }

  // Classify the existing row (if any) before the transaction. An SSO ghost
  // (no `invitedAt`) is absorbed; a real prior invite requires `resend: true`.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, invitedAt: true },
  });

  const isSsoGhost = existing !== null && existing.invitedAt === null;
  const isPriorInvite = existing !== null && existing.invitedAt !== null;

  if (isPriorInvite && !resendRequested) {
    return NextResponse.json(
      {
        error: "A user with this email has already been invited",
        code: "already_invited",
      },
      { status: 409 },
    );
  }

  // Pre-create (or update) user + enrollments atomically.
  const { user, created, skipped, invalid, courseTitleMap, wasUpdate } =
    await prisma.$transaction(async (tx) => {
      let user;
      let wasUpdate = false;

      if (existing) {
        // Ghost adoption or resend — refresh invite metadata and role.
        user = await tx.user.update({
          where: { id: existing.id },
          data: {
            name: name ?? undefined,
            role: appRoleToPrisma(role),
            invitedAt: new Date(),
            invitedById: inviterId,
          },
          select: { id: true, email: true, name: true, role: true, createdAt: true },
        });
        wasUpdate = true;
      } else {
        user = await tx.user.create({
          data: {
            email,
            name,
            role: appRoleToPrisma(role),
            invitedAt: new Date(),
            invitedById: inviterId,
          },
          select: { id: true, email: true, name: true, role: true, createdAt: true },
        });
      }

      const enrollmentResult =
        courseIds.length > 0
          ? await createEnrollments(tx, {
              userId: user.id,
              courseIds,
              enrolledById: inviterId,
            })
          : {
              created: [],
              skipped: [],
              invalid: [],
              courseTitleMap: new Map<string, string>(),
            };

      return { user, ...enrollmentResult, wasUpdate };
    });

  // Fire off the invite email. Don't fail the request if Resend is down —
  // the user row already exists and the admin can resend later.
  const inviter = await prisma.user.findUnique({
    where: { id: inviterId },
    select: { name: true, email: true },
  });
  const inviterName = inviter?.name?.trim() || inviter?.email || "An administrator";
  const assignedCourses = created.map((c) => c.course.title);

  let emailSent = false;
  let emailError: string | null = null;
  try {
    emailSent = await sendUserInviteEmail({
      to: email,
      name: user.name ?? null,
      inviterName,
      assignedCourses,
    });
    if (!emailSent) {
      // sendUserInviteEmail returns false when RESEND_API_KEY is unset.
      emailError = "email_not_configured";
    }
  } catch (err) {
    console.error("[invite] Failed to send invite email", err);
    emailError = "send_failed";
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        createdAt: user.createdAt.toISOString(),
      },
      enrollmentCount: created.length,
      skippedCount: skipped.length,
      invalidCourseIds: invalid,
      emailSent,
      emailError,
      resent: wasUpdate && (isPriorInvite || isSsoGhost),
      assignedCourseTitles: assignedCourses,
      // Debug hint in case the caller wants to surface invalid IDs
      courseTitles: Object.fromEntries(courseTitleMap),
    },
    { status: wasUpdate ? 200 : 201 },
  );
}
