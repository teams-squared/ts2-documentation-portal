import { prisma } from "@/lib/prisma";

/**
 * Returns true when the given (driveId, itemId) pair is referenced by an
 * existing LMS surface — a POLICY_DOC lesson (PolicyDocLesson), a curated
 * public-library doc (PublicIsoDoc), or a "document" / "html" lesson via the
 * JSON SharePointDocumentRef stored in Lesson.content.
 *
 * Used to gate /api/sharepoint/files/[driveId]/[itemId] so an authenticated
 * user cannot proxy *arbitrary* SharePoint items by guessing IDs — only
 * items that have been deliberately curated by an admin.
 */
export async function isAllowlistedSharePointItem(
  driveId: string,
  itemId: string,
): Promise<boolean> {
  if (!driveId || !itemId) return false;

  // Fast path: POLICY_DOC lessons hold the pointer in dedicated columns.
  const policyMatch = await prisma.policyDocLesson.findFirst({
    where: {
      sharePointDriveId: driveId,
      sharePointItemId: itemId,
    },
    select: { id: true },
  });
  if (policyMatch) return true;

  // Public ISO library (curated by admins at /admin/iso → Public library).
  const publicMatch = await prisma.publicIsoDoc.findFirst({
    where: {
      sharePointDriveId: driveId,
      sharePointItemId: itemId,
    },
    select: { id: true },
  });
  if (publicMatch) return true;

  // Slow path: "document" / "html" lesson types serialise a
  // SharePointDocumentRef into Lesson.content as JSON text. Use a substring
  // match rather than a jsonb cast so the query is safe even when other
  // lesson types store non-JSON text content. LIKE wildcards in the user-
  // supplied values are escaped so a driveId containing `_` or `%` cannot
  // widen the match.
  const drivePattern = `%"driveId":"${escapeLike(driveId)}"%`;
  const itemPattern = `%"itemId":"${escapeLike(itemId)}"%`;

  const lessonMatch = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Lesson"
    WHERE content IS NOT NULL
      AND content LIKE ${drivePattern} ESCAPE '\\'
      AND content LIKE ${itemPattern} ESCAPE '\\'
    LIMIT 1
  `;
  return lessonMatch.length > 0;
}

function escapeLike(s: string): string {
  return s.replace(/[\\_%]/g, "\\$&");
}
