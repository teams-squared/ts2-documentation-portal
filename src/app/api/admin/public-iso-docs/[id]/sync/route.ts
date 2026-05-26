import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { syncPublicIsoDoc } from "@/lib/policy-doc/sync";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/public-iso-docs/[id]/sync — manual re-sync. Pulls the
 * latest SharePoint metadata; if the eTag is unchanged, returns a noop.
 * Otherwise re-parses and updates the row in place.
 */
export async function POST(_request: Request, { params }: Params) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const row = await prisma.publicIsoDoc.findUnique({
    where: { id },
    select: { id: true, sharePointDriveId: true, sharePointItemId: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const outcome = await syncPublicIsoDoc({
      docId: row.id,
      driveId: row.sharePointDriveId,
      itemId: row.sharePointItemId,
      actorUserId: auth.userId,
    });
    return NextResponse.json(outcome);
  } catch (err) {
    console.error("[public-iso-doc] sync failed:", err);
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
