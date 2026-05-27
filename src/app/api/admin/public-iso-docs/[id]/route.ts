import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

const PatchBody = z.object({
  sortOrder: z.number().int().optional(),
  isHidden: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH — currently just sortOrder. Other fields (title, version, etc.)
 * are owned by SharePoint and updated via a re-sync.
 *
 * DELETE — drop the doc from the public library. SharePoint file is
 * untouched. Once gone, the allowlist no longer matches and the proxy
 * stops streaming it.
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const row = await prisma.publicIsoDoc.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.publicIsoDoc.update({
    where: { id },
    data: {
      ...(parsed.data.sortOrder !== undefined && {
        sortOrder: parsed.data.sortOrder,
      }),
      ...(parsed.data.isHidden !== undefined && {
        isHidden: parsed.data.isHidden,
      }),
    },
  });

  return NextResponse.json({
    doc: {
      id: updated.id,
      sortOrder: updated.sortOrder,
      isHidden: updated.isHidden,
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireRole("admin");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  try {
    await prisma.publicIsoDoc.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
