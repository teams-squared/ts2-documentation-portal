import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PolicyDocViewer } from "@/components/courses/PolicyDocViewer";
import type {
  ReviewHistoryEntry,
  RevisionHistoryEntry,
} from "@/lib/policy-doc/types";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PolicyDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const doc = await prisma.publicIsoDoc.findUnique({ where: { id } });
  if (!doc) notFound();

  // Fire-and-forget audit row. Admins use this to see which public docs
  // are actually being read. Not used for ack evidence — that pipeline
  // stays exclusively on LessonProgress for POLICY_DOC lessons.
  void prisma.isoLibraryView
    .create({
      data: {
        publicIsoDocId: doc.id,
        userId: session.user!.id!,
        sourceVersion: doc.sourceVersion,
      },
    })
    .catch((err) => {
      console.error("[policies] view log failed:", err);
    });

  // reviewHistory / revisionHistory are stored as JSON; the parser emits
  // the same shape consumed by PolicyDocViewer, so we cast through unknown.
  const reviewHistory = (doc.reviewHistory as unknown as ReviewHistoryEntry[]) ?? [];
  const revisionHistory =
    (doc.revisionHistory as unknown as RevisionHistoryEntry[]) ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <Link
        href="/policies"
        className="mb-3 inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to policies
      </Link>
      <PolicyDocViewer
        lessonId={doc.id}
        lessonTitle={doc.documentTitle}
        documentTitle={doc.documentTitle}
        documentCode={doc.documentCode}
        sourceVersion={doc.sourceVersion}
        approver={doc.approver}
        approvedOn={doc.approvedOn ? doc.approvedOn.toISOString() : null}
        lastReviewedOn={
          doc.lastReviewedOn ? doc.lastReviewedOn.toISOString() : null
        }
        sharePointDriveId={doc.sharePointDriveId}
        sharePointItemId={doc.sharePointItemId}
        sharePointWebUrl={doc.sharePointWebUrl}
        revisionHistory={revisionHistory.map(toRevisionRow)}
        reviewHistory={reviewHistory.map(toReviewRow)}
        lastAcknowledgement={null}
        acknowledgementMode="none"
      />
    </div>
  );
}

// PolicyDocViewer expects its own minimal row shapes (a strict subset of the
// parser's HistoryEntry types). Map nulls / missing fields safely.
function toRevisionRow(r: RevisionHistoryEntry) {
  return {
    date: r.date,
    initialVersion: r.initialVersion,
    description: r.description,
    pages: r.pages,
    proposedBy: r.proposedBy,
    changedBy: r.changedBy,
    finalVersion: r.finalVersion,
    approvedBy: r.approvedBy,
  };
}

function toReviewRow(r: ReviewHistoryEntry) {
  return {
    date: r.date,
    reviewedVersion: r.reviewedVersion,
    changesRequired: r.changesRequired,
    reviewedBy: r.reviewedBy,
    approvedBy: r.approvedBy,
  };
}
