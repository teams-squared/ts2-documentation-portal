import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { syncPublicIsoDoc } from "@/lib/policy-doc/sync";

const CreateBody = z.object({
  driveId: z.string().min(1),
  itemId: z.string().min(1),
});

/**
 * GET /api/admin/public-iso-docs — list every PublicIsoDoc row for the
 * admin manager UI. Sorted by sortOrder, then publishedAt for ties.
 *
 * POST — add a SharePoint doc to the public library. Triggers an initial
 * sync (fetch + parse + write) and returns the resulting row.
 *
 * Admin-only (matches the rest of /admin/iso).
 */
export async function GET() {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const rows = await prisma.publicIsoDoc.findMany({
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "asc" }],
    select: {
      id: true,
      sharePointDriveId: true,
      sharePointItemId: true,
      sharePointWebUrl: true,
      documentTitle: true,
      documentCode: true,
      sourceVersion: true,
      sourceLastModified: true,
      approver: true,
      approvedOn: true,
      lastReviewedOn: true,
      sortOrder: true,
      publishedAt: true,
      lastSyncedAt: true,
      lastSyncedBy: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json({ docs: rows });
}

export async function POST(request: Request) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const json = await request.json().catch(() => null);
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const outcome = await syncPublicIsoDoc({
      driveId: parsed.data.driveId,
      itemId: parsed.data.itemId,
      actorUserId: auth.userId,
    });
    return NextResponse.json(outcome, { status: 201 });
  } catch (err) {
    console.error("[public-iso-doc] create failed:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
