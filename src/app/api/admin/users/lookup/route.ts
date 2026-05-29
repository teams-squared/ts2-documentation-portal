import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roles";
import { normalizeInviteEmail } from "@/lib/inviteEmail";
import { lookupTenantUser } from "@/lib/entra/graph";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/admin/users/lookup?email=...
 *
 * Checks whether an address exists in the Entra tenant so the invite form can
 * warn (not block) before sending to an unknown recipient. Advisory only —
 * returns `{ status: "unknown" }` whenever Graph is unconfigured/unreachable
 * so the caller fails open. Same gate as the invite endpoint (course_manager+).
 */
export async function GET(request: Request) {
  const authResult = await requireRole("course_manager");
  if (authResult instanceof NextResponse) return authResult;

  const raw = new URL(request.url).searchParams.get("email") ?? "";
  const email = normalizeInviteEmail(raw);
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const result = await lookupTenantUser(email);
  return NextResponse.json(result);
}
