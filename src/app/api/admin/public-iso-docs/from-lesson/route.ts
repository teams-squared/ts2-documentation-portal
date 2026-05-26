import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  policyDocLessonId: z.string().min(1),
});

/**
 * GET — list every POLICY_DOC lesson the admin could promote to the public
 * library. Excludes lessons whose SP pointer is already in PublicIsoDoc
 * (the @@unique constraint would reject a duplicate anyway).
 *
 * POST — promote an existing POLICY_DOC lesson. Copies its SP pointer +
 * already-parsed snapshot fields into a new PublicIsoDoc row. No Graph
 * round-trip needed since PolicyDocLesson holds a fresh parsed snapshot.
 */
export async function GET() {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const [lessons, alreadyPublic] = await Promise.all([
    prisma.policyDocLesson.findMany({
      select: {
        id: true,
        sharePointDriveId: true,
        sharePointItemId: true,
        documentTitle: true,
        documentCode: true,
        sourceVersion: true,
        lesson: {
          select: { title: true, module: { select: { course: { select: { title: true } } } } },
        },
      },
      orderBy: { documentCode: "asc" },
    }),
    prisma.publicIsoDoc.findMany({
      select: { sharePointDriveId: true, sharePointItemId: true },
    }),
  ]);

  const alreadyKeys = new Set(
    alreadyPublic.map((d) => `${d.sharePointDriveId}|${d.sharePointItemId}`),
  );

  const available = lessons
    .filter((l) => !alreadyKeys.has(`${l.sharePointDriveId}|${l.sharePointItemId}`))
    .map((l) => ({
      policyDocLessonId: l.id,
      documentTitle: l.documentTitle,
      documentCode: l.documentCode,
      sourceVersion: l.sourceVersion,
      courseTitle: l.lesson.module.course.title,
      lessonTitle: l.lesson.title,
    }));

  return NextResponse.json({ available });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const lesson = await prisma.policyDocLesson.findUnique({
    where: { id: parsed.data.policyDocLessonId },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  try {
    const created = await prisma.publicIsoDoc.create({
      data: {
        sharePointDriveId: lesson.sharePointDriveId,
        sharePointItemId: lesson.sharePointItemId,
        sharePointWebUrl: lesson.sharePointWebUrl,
        documentTitle: lesson.documentTitle,
        documentCode: lesson.documentCode,
        sourceVersion: lesson.sourceVersion,
        sourceETag: lesson.sourceETag,
        sourceLastModified: lesson.sourceLastModified,
        approver: lesson.approver,
        approvedOn: lesson.approvedOn,
        lastReviewedOn: lesson.lastReviewedOn,
        reviewHistory: lesson.reviewHistory as unknown as object,
        revisionHistory: lesson.revisionHistory as unknown as object,
        publishedById: auth.userId,
        lastSyncedAt: lesson.lastSyncedAt,
        lastSyncedById: auth.userId,
      },
    });
    return NextResponse.json(
      { status: "created", doc: { id: created.id, documentTitle: created.documentTitle } },
      { status: 201 },
    );
  } catch (err) {
    // P2002 = unique-constraint violation (SP pointer already in library).
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "This document is already in the public library." },
        { status: 409 },
      );
    }
    console.error("[public-iso-doc] from-lesson failed:", err);
    return NextResponse.json({ error: "Failed to add" }, { status: 500 });
  }
}
