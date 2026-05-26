/**
 * Sync a Teams Squared ISO policy doc from SharePoint into a PolicyDocLesson
 * row.
 *
 * Called from:
 *   - Admin authoring (initial bind of a lesson to a SharePoint item).
 *   - Manual "Re-sync" button on the admin lesson editor.
 *   - (Future) scheduled cron that polls every published lesson nightly.
 *
 * Two-stage check to keep Graph traffic minimal:
 *   1. HEAD-equivalent metadata fetch — compare `eTag` against the stored
 *      `sourceETag`. If equal, the file hasn't been touched in SharePoint;
 *      bail out as a no-op.
 *   2. If different, download the bytes, parse, and upsert the row. If the
 *      parsed `sourceVersion` differs from the stored one, INVALIDATE all
 *      learner acknowledgements for this lesson — they read an older
 *      version and need to re-acknowledge.
 *
 * Invalidation strategy: clear `completedAt`, `acknowledgedAt`, and the
 * three audit-snapshot fields on every LessonProgress row pointing at this
 * lesson. The historical evidence isn't lost — it's preserved in PostHog
 * via the `policy_doc_acknowledged` event we fire on each ack — but the
 * LMS state is reset so the learner sees the lesson un-completed and is
 * forced to scroll-and-acknowledge again.
 */

import { prisma } from "@/lib/prisma";
import { trackEvent } from "@/lib/posthog-server";
import {
  getDriveItemContent,
  getDriveItemMetadata,
  type DriveItem,
} from "@/lib/sharepoint";
import { parsePolicyDoc } from "./parser";
import type { ParsedPolicyDoc } from "./types";

export interface SyncPolicyDocInput {
  /** Lesson row to bind / re-sync. Must already exist with type=POLICY_DOC. */
  lessonId: string;
  /** SharePoint pointer. */
  driveId: string;
  itemId: string;
  /** User who triggered the sync (admin / course manager). Stored on
   *  PolicyDocLesson.lastSyncedById for auditability. */
  actorUserId: string;
}

export type SyncOutcome =
  | {
      status: "noop";
      reason: "etag-unchanged";
      lesson: { id: string; sourceVersion: string; sourceETag: string };
    }
  | {
      status: "synced";
      versionChanged: boolean;
      invalidatedAcknowledgements: number;
      lesson: {
        id: string;
        sourceVersion: string;
        sourceETag: string;
        documentTitle: string;
        documentCode: string | null;
      };
      warnings: string[];
    };

/**
 * Sync a SharePoint policy doc into the LMS.
 *
 * Idempotent: calling repeatedly without a SharePoint change is cheap (one
 * metadata roundtrip) and a no-op.
 */
export async function syncPolicyDoc(
  input: SyncPolicyDocInput,
): Promise<SyncOutcome> {
  const { lessonId, driveId, itemId, actorUserId } = input;

  // Step 1: pull metadata. We need eTag to short-circuit, lastModified for
  // the audit trail, and webUrl for the "Open in SharePoint" fallback link.
  const meta = await getDriveItemMetadata(driveId, itemId);
  const sourceETag = normalizeETag(meta.eTag);
  if (!sourceETag) {
    throw new Error(
      `SharePoint item ${itemId} returned no eTag — cannot reliably sync.`,
    );
  }

  const existing = await prisma.policyDocLesson.findUnique({
    where: { lessonId },
  });

  // Step 2a: nothing changed in SP since we last looked → noop.
  if (existing && existing.sourceETag === sourceETag) {
    return {
      status: "noop",
      reason: "etag-unchanged",
      lesson: {
        id: existing.id,
        sourceVersion: existing.sourceVersion,
        sourceETag: existing.sourceETag,
      },
    };
  }

  // Step 2b: fetch + parse the file. mammoth wants a Node Buffer.
  const fileBuffer = await fetchDriveItemBuffer(driveId, itemId);
  const parsed = await parsePolicyDoc(fileBuffer, meta.name);

  const versionChanged =
    existing != null && existing.sourceVersion !== parsed.sourceVersion;

  // Step 3: write everything in a single transaction so a partial sync
  // can't leave the lesson half-updated with stale acknowledgements still
  // in place.
  const result = await prisma.$transaction(async (tx) => {
    const upserted = await tx.policyDocLesson.upsert({
      where: { lessonId },
      create: buildCreateData({ lessonId, driveId, meta, parsed, actorUserId, sourceETag }),
      update: buildUpdateData({ driveId, meta, parsed, actorUserId, sourceETag }),
    });

    let invalidatedAcknowledgements = 0;
    if (versionChanged) {
      const updated = await tx.lessonProgress.updateMany({
        where: { lessonId, acknowledgedAt: { not: null } },
        data: {
          completedAt: null,
          acknowledgedAt: null,
          acknowledgedVersion: null,
          acknowledgedETag: null,
          acknowledgedHash: null,
        },
      });
      invalidatedAcknowledgements = updated.count;
    }

    return { upserted, invalidatedAcknowledgements };
  });

  // Fire-and-forget analytics. Distinct ID is the actor; the version bump
  // is what auditors care about.
  trackEvent(actorUserId, "policy_doc_synced", {
    lessonId,
    documentCode: parsed.documentCode,
    sourceVersion: parsed.sourceVersion,
    versionChanged,
    invalidatedAcknowledgements: result.invalidatedAcknowledgements,
    warningsCount: parsed.warnings.length,
  });

  return {
    status: "synced",
    versionChanged,
    invalidatedAcknowledgements: result.invalidatedAcknowledgements,
    lesson: {
      id: result.upserted.id,
      sourceVersion: result.upserted.sourceVersion,
      sourceETag: result.upserted.sourceETag,
      documentTitle: result.upserted.documentTitle,
      documentCode: result.upserted.documentCode,
    },
    warnings: parsed.warnings,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Graph wraps eTags in quotes and sometimes appends a comma+revision suffix.
 *  Normalize so byte-comparison is meaningful. */
function normalizeETag(raw: string | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/^"|"$/g, "").trim() || null;
}

async function fetchDriveItemBuffer(
  driveId: string,
  itemId: string,
): Promise<Buffer> {
  const res = await getDriveItemContent(driveId, itemId);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

interface BuildArgs {
  lessonId?: string;
  driveId: string;
  meta: DriveItem;
  parsed: ParsedPolicyDoc;
  actorUserId: string;
  sourceETag: string;
}

function buildCreateData(args: Required<Pick<BuildArgs, "lessonId">> & BuildArgs) {
  return {
    lessonId: args.lessonId,
    sharePointDriveId: args.driveId,
    sharePointItemId: args.meta.id,
    sharePointWebUrl: args.meta.webUrl ?? "",
    documentTitle: args.parsed.documentTitle,
    documentCode: args.parsed.documentCode,
    sourceVersion: args.parsed.sourceVersion,
    sourceETag: args.sourceETag,
    sourceLastModified: parseGraphDate(args.meta.lastModifiedDateTime),
    approver: args.parsed.approver,
    approvedOn: args.parsed.approvedOn,
    lastReviewedOn: args.parsed.lastReviewedOn,
    reviewHistory: args.parsed.reviewHistory as unknown as object,
    revisionHistory: args.parsed.revisionHistory as unknown as object,
    renderMode: args.parsed.renderMode,
    renderedHTML: args.parsed.renderedHTML,
    renderedHTMLHash: args.parsed.renderedHTMLHash,
    lastSyncedAt: new Date(),
    lastSyncedById: args.actorUserId,
  };
}

function buildUpdateData(args: BuildArgs) {
  return {
    sharePointDriveId: args.driveId,
    sharePointWebUrl: args.meta.webUrl ?? "",
    documentTitle: args.parsed.documentTitle,
    documentCode: args.parsed.documentCode,
    sourceVersion: args.parsed.sourceVersion,
    sourceETag: args.sourceETag,
    sourceLastModified: parseGraphDate(args.meta.lastModifiedDateTime),
    approver: args.parsed.approver,
    approvedOn: args.parsed.approvedOn,
    lastReviewedOn: args.parsed.lastReviewedOn,
    reviewHistory: args.parsed.reviewHistory as unknown as object,
    revisionHistory: args.parsed.revisionHistory as unknown as object,
    renderMode: args.parsed.renderMode,
    renderedHTML: args.parsed.renderedHTML,
    renderedHTMLHash: args.parsed.renderedHTMLHash,
    lastSyncedAt: new Date(),
    lastSyncedById: args.actorUserId,
  };
}

function parseGraphDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

// ─── Public-library variant ─────────────────────────────────────────────────

export interface SyncPublicIsoDocInput {
  /** PublicIsoDoc row to re-sync. If omitted, treat (driveId, itemId) as a
   *  new doc to be created on the public library. */
  docId?: string;
  driveId: string;
  itemId: string;
  /** Admin who triggered the sync. */
  actorUserId: string;
}

export type SyncPublicIsoDocOutcome =
  | {
      status: "noop";
      reason: "etag-unchanged";
      doc: { id: string; sourceVersion: string; sourceETag: string };
    }
  | {
      status: "synced";
      created: boolean;
      versionChanged: boolean;
      doc: {
        id: string;
        sourceVersion: string;
        sourceETag: string;
        documentTitle: string;
        documentCode: string | null;
      };
      warnings: string[];
    };

/**
 * Sync a SharePoint policy doc into the public library (`PublicIsoDoc`).
 *
 * Mirrors `syncPolicyDoc` but writes to PublicIsoDoc instead of
 * PolicyDocLesson, and never invalidates acknowledgements (the model has
 * no ack pipeline — the public library is read-reference, not evidence).
 *
 * Idempotent: re-running without a SharePoint change is a one-roundtrip
 * no-op via the eTag short-circuit.
 */
export async function syncPublicIsoDoc(
  input: SyncPublicIsoDocInput,
): Promise<SyncPublicIsoDocOutcome> {
  const { docId, driveId, itemId, actorUserId } = input;

  const meta = await getDriveItemMetadata(driveId, itemId);
  const sourceETag = normalizeETag(meta.eTag);
  if (!sourceETag) {
    throw new Error(
      `SharePoint item ${itemId} returned no eTag — cannot reliably sync.`,
    );
  }

  // Locate existing row, either by id (re-sync) or by SP pointer (add path
  // when the same SP file is already in the library — upgrade to an
  // in-place re-sync rather than failing the unique constraint).
  const existing = docId
    ? await prisma.publicIsoDoc.findUnique({ where: { id: docId } })
    : await prisma.publicIsoDoc.findUnique({
        where: {
          sharePointDriveId_sharePointItemId: {
            sharePointDriveId: driveId,
            sharePointItemId: itemId,
          },
        },
      });

  if (existing && existing.sourceETag === sourceETag) {
    return {
      status: "noop",
      reason: "etag-unchanged",
      doc: {
        id: existing.id,
        sourceVersion: existing.sourceVersion,
        sourceETag: existing.sourceETag,
      },
    };
  }

  const fileBuffer = await fetchDriveItemBuffer(driveId, itemId);
  const parsed = await parsePolicyDoc(fileBuffer, meta.name);

  const versionChanged =
    existing != null && existing.sourceVersion !== parsed.sourceVersion;

  const upserted = existing
    ? await prisma.publicIsoDoc.update({
        where: { id: existing.id },
        data: {
          sharePointDriveId: driveId,
          sharePointWebUrl: meta.webUrl ?? "",
          documentTitle: parsed.documentTitle,
          documentCode: parsed.documentCode,
          sourceVersion: parsed.sourceVersion,
          sourceETag,
          sourceLastModified: parseGraphDate(meta.lastModifiedDateTime),
          approver: parsed.approver,
          approvedOn: parsed.approvedOn,
          lastReviewedOn: parsed.lastReviewedOn,
          reviewHistory: parsed.reviewHistory as unknown as object,
          revisionHistory: parsed.revisionHistory as unknown as object,
          lastSyncedAt: new Date(),
          lastSyncedById: actorUserId,
        },
      })
    : await prisma.publicIsoDoc.create({
        data: {
          sharePointDriveId: driveId,
          sharePointItemId: meta.id,
          sharePointWebUrl: meta.webUrl ?? "",
          documentTitle: parsed.documentTitle,
          documentCode: parsed.documentCode,
          sourceVersion: parsed.sourceVersion,
          sourceETag,
          sourceLastModified: parseGraphDate(meta.lastModifiedDateTime),
          approver: parsed.approver,
          approvedOn: parsed.approvedOn,
          lastReviewedOn: parsed.lastReviewedOn,
          reviewHistory: parsed.reviewHistory as unknown as object,
          revisionHistory: parsed.revisionHistory as unknown as object,
          publishedById: actorUserId,
          lastSyncedAt: new Date(),
          lastSyncedById: actorUserId,
        },
      });

  trackEvent(actorUserId, "public_iso_doc_synced", {
    docId: upserted.id,
    documentCode: parsed.documentCode,
    sourceVersion: parsed.sourceVersion,
    created: !existing,
    versionChanged,
    warningsCount: parsed.warnings.length,
  });

  return {
    status: "synced",
    created: !existing,
    versionChanged,
    doc: {
      id: upserted.id,
      sourceVersion: upserted.sourceVersion,
      sourceETag: upserted.sourceETag,
      documentTitle: upserted.documentTitle,
      documentCode: upserted.documentCode,
    },
    warnings: parsed.warnings,
  };
}
