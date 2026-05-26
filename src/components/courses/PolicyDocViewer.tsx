"use client";

/**
 * Learner-facing renderer for POLICY_DOC lessons.
 *
 * Renders the original ISO/policy Word document inline as a PDF (Microsoft
 * Graph converts the .docx → .pdf server-side; we stream it through the
 * SharePoint proxy with ?format=pdf). This preserves the Word doc's
 * formatting, tables, and images exactly as authored.
 *
 * The "Acknowledge" button (in LessonFooter) is gated by **two** signals:
 *   1. A minimum dwell of 6 minutes with the tab focused — long enough
 *      that the learner has actually had time to read a typical policy.
 *      Background tabs do not count.
 *   2. An explicit attestation checkbox — "I have read and understood
 *      [title] v[version]". This is what ISO auditors actually recognize.
 *
 * When both signals are satisfied, we fire `POLICY_ACK_EVENT` on the
 * window. LessonFooter listens for that event (unchanged from the old
 * scroll-sentinel flow) and enables its CTA.
 *
 * Surfaces:
 *   - Document Control panel (title, code, version, approver, dates,
 *     collapsed full revision history)
 *   - Stale acknowledgement banner — when the user previously acknowledged
 *     an older version
 *   - Inline PDF render of the current version
 *   - Attestation block (dwell progress + checkbox)
 */

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { LessonTitleHeader } from "./LessonTitleHeader";
import { formatPolicyAttestation } from "@/lib/policy-doc/attestation";

export interface PolicyDocViewProps {
  lessonId: string;
  lessonTitle: string;
  documentTitle: string;
  documentCode: string | null;
  sourceVersion: string;
  approver: string | null;
  approvedOn: string | null; // ISO
  lastReviewedOn: string | null; // ISO
  /** IDs needed to stream the PDF conversion through our SharePoint proxy. */
  sharePointDriveId: string;
  sharePointItemId: string;
  /** Pulled from RevisionHistoryEntry[]; parsed JSON shape. */
  revisionHistory: RevisionRow[];
  /** Pulled from ReviewHistoryEntry[]. */
  reviewHistory: ReviewRow[];
  /** SP "Open in" link for the original Word doc. */
  sharePointWebUrl: string;
  /** Latest acknowledgement (if any) by the current learner. Used to detect
   *  stale acknowledgements after a version bump. */
  lastAcknowledgement: {
    version: string | null;
    acknowledgedAt: string | null;
  } | null;
  /** If the learner has already completed this lesson, we skip the dwell/
   *  attestation gate — the ack is already captured. */
  alreadyCompleted?: boolean;
  /** Controls the dwell-timer + attestation flow.
   *  - "required" (default): the LMS-lesson behaviour — dwell, checkbox,
   *    stale-ack banner, POLICY_ACK_EVENT dispatch.
   *  - "none": read-only viewer (used by the public library at /policies).
   *    No gating, no tracking — just Document Control panel + PDF iframe. */
  acknowledgementMode?: "required" | "none";
}

interface RevisionRow {
  date: string | null;
  initialVersion: string | null;
  description: string | null;
  pages: string | null;
  proposedBy: string | null;
  changedBy: string | null;
  finalVersion: string | null;
  approvedBy: string | null;
}

interface ReviewRow {
  date: string | null;
  reviewedVersion: string | null;
  changesRequired: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
}

/** Window event fired when dwell + attestation are both satisfied. The
 *  LessonFooter listens for this matching `lessonId` to enable its CTA. */
export const POLICY_ACK_EVENT = "policy-doc-acknowledgeable";

/** Minimum focused-tab dwell before the attestation checkbox is accepted. */
const DWELL_MS = 6 * 60 * 1000;

/** Per-lesson sessionStorage key. Persists dwell progress across same-tab
 *  navigation away/back so learners don't lose progress on an accidental
 *  route change. Cleared on full unlock and not synced across tabs. */
const dwellStorageKey = (lessonId: string) => `policy-doc-dwell:${lessonId}`;

function readPersistedDwell(lessonId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(dwellStorageKey(lessonId));
    if (!raw) return 0;
    const ms = Number.parseInt(raw, 10);
    if (!Number.isFinite(ms) || ms < 0) return 0;
    return Math.min(DWELL_MS, ms);
  } catch {
    return 0;
  }
}

export function PolicyDocViewer(props: PolicyDocViewProps) {
  const {
    lessonId,
    lessonTitle,
    documentTitle,
    documentCode,
    sourceVersion,
    approver,
    approvedOn,
    lastReviewedOn,
    sharePointDriveId,
    sharePointItemId,
    revisionHistory,
    reviewHistory,
    sharePointWebUrl,
    lastAcknowledgement,
    alreadyCompleted = false,
    acknowledgementMode = "required",
  } = props;

  const ackRequired = acknowledgementMode === "required";

  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [showReviewHistory, setShowReviewHistory] = useState(false);
  // The full Document Control panel collapses by default to maximise the
  // vertical space the PDF gets. The slim header always shows the essentials
  // (code · version · approver). Learners who want the full detail can
  // expand it.
  const [showDocControl, setShowDocControl] = useState(false);

  // Dwell: accumulated ms of focused-tab time. We tick a 100ms interval
  // only while document.visibilityState === "visible", so background tabs
  // don't count. In read-only mode the timer is short-circuited to "done"
  // so the attestation block + stale banner stay hidden.
  const [dwellMs, setDwellMs] = useState(() =>
    !ackRequired || alreadyCompleted ? DWELL_MS : readPersistedDwell(lessonId),
  );

  // Persist dwell to sessionStorage so a same-tab nav-away/back doesn't reset
  // the 6-minute timer. Cleared once fully completed since alreadyCompleted
  // will short-circuit the timer on next mount anyway.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ackRequired) return;
    if (alreadyCompleted) return;
    try {
      if (dwellMs >= DWELL_MS) {
        window.sessionStorage.removeItem(dwellStorageKey(lessonId));
      } else if (dwellMs > 0) {
        window.sessionStorage.setItem(
          dwellStorageKey(lessonId),
          String(dwellMs),
        );
      }
    } catch {
      /* sessionStorage unavailable (e.g. Safari private mode) — silent fallback */
    }
  }, [dwellMs, lessonId, alreadyCompleted, ackRequired]);

  const [attested, setAttested] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!ackRequired) return;
    if (alreadyCompleted) return;
    if (dwellMs >= DWELL_MS) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (intervalId != null) return;
      intervalId = setInterval(() => {
        setDwellMs((ms) => Math.min(DWELL_MS, ms + 100));
      }, 100);
    }
    function stop() {
      if (intervalId == null) return;
      clearInterval(intervalId);
      intervalId = null;
    }
    function onVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dwellMs, alreadyCompleted, ackRequired]);

  // Fire the unlock event once dwell + attestation are both satisfied.
  // The event detail carries the observed dwell seconds at unlock time so
  // LessonFooter can forward it to the complete route as audit evidence
  // ("reasonable opportunity to read" — ISO 27001 7.3 Awareness).
  const dwellDone = dwellMs >= DWELL_MS;
  const unlocked = alreadyCompleted || (dwellDone && attested);
  useEffect(() => {
    if (!ackRequired) return;
    if (!unlocked || firedRef.current) return;
    firedRef.current = true;
    window.dispatchEvent(
      new CustomEvent(POLICY_ACK_EVENT, {
        detail: {
          lessonId,
          dwellSeconds: Math.floor(dwellMs / 1000),
        },
      }),
    );
  }, [unlocked, lessonId, dwellMs, ackRequired]);

  const isStaleAck =
    ackRequired &&
    lastAcknowledgement?.version != null &&
    lastAcknowledgement.version !== sourceVersion;

  // No `view=` directive — letting the browser pick its default keeps the
  // PDF at its native zoom instead of scaling it up to fill our wider
  // iframe (which made text huge and dropped lines-per-screen).
  const pdfSrc = `/api/sharepoint/files/${encodeURIComponent(sharePointDriveId)}/${encodeURIComponent(sharePointItemId)}?format=pdf#toolbar=1&navpanes=0`;

  const dwellPct = Math.round((dwellMs / DWELL_MS) * 100);
  const dwellSecondsRemaining = Math.max(0, Math.ceil((DWELL_MS - dwellMs) / 1000));
  const dwellMmSs = `${Math.floor(dwellSecondsRemaining / 60)
    .toString()
    .padStart(1, "0")}:${(dwellSecondsRemaining % 60).toString().padStart(2, "0")}`;

  return (
    <div>
      <LessonTitleHeader
        title={lessonTitle}
        type="policy_doc"
        formatLabel={documentCode ? `${documentCode} · v${sourceVersion}` : `Policy doc · v${sourceVersion}`}
      />

      {isStaleAck && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/60 bg-warning-subtle px-5 py-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold text-warning">
              Policy updated since your last acknowledgement
            </p>
            <p className="mt-0.5 text-foreground-muted">
              You acknowledged v{lastAcknowledgement.version}. The current
              version is v{sourceVersion}. Please re-read and acknowledge.
            </p>
          </div>
        </div>
      )}

      {/* Document Control — slim header by default with a disclosure that
          expands the full metadata grid + revision/review history tables.
          The header is one line so it doesn't push the PDF down. */}
      <section aria-label="Document control" className="mb-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm">
          <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-foreground">{documentTitle}</span>
            <span className="text-foreground-muted">
              {documentCode && (
                <>
                  {" · "}
                  <span className="font-mono text-xs">{documentCode}</span>
                </>
              )}
              {" · "}v{sourceVersion}
              {approver && (
                <span className="hidden sm:inline">
                  {" · "}Approved by {approver}
                </span>
              )}
            </span>
          </span>
          <a
            href={sharePointWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden shrink-0 text-xs text-primary hover:underline sm:inline"
          >
            Open in SharePoint ↗
          </a>
          <button
            type="button"
            onClick={() => setShowDocControl((s) => !s)}
            aria-expanded={showDocControl}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded-sm"
          >
            {showDocControl ? (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Details
          </button>
        </div>

        {showDocControl && (
          <div className="mt-2 rounded-lg border border-border bg-surface p-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
              {documentCode && <Row label="Document code" value={documentCode} />}
              <Row label="Version" value={sourceVersion} />
              {approver && <Row label="Approved by" value={approver} />}
              {approvedOn && <Row label="Approved on" value={formatDate(approvedOn)} />}
              {lastReviewedOn && <Row label="Last reviewed" value={formatDate(lastReviewedOn)} />}
            </dl>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={sharePointWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline sm:hidden"
              >
                Open original in SharePoint ↗
              </a>
              {revisionHistory.length > 0 && (
                <DisclosureButton
                  open={showRevisionHistory}
                  onClick={() => setShowRevisionHistory((s) => !s)}
                  label={`Revision history (${revisionHistory.length})`}
                />
              )}
              {reviewHistory.length > 0 && (
                <DisclosureButton
                  open={showReviewHistory}
                  onClick={() => setShowReviewHistory((s) => !s)}
                  label={`Review history (${reviewHistory.length})`}
                />
              )}
            </div>
            {showRevisionHistory && revisionHistory.length > 0 && (
              <RevisionTable rows={revisionHistory} />
            )}
            {showReviewHistory && reviewHistory.length > 0 && (
              <ReviewTable rows={reviewHistory} />
            )}
          </div>
        )}
      </section>

      {/* Reading-time timer — explicit framing so learners understand the
          Acknowledge button is locked until the timer hits zero. Earlier
          wording ("Reading time required") left users wondering why the
          button stayed disabled. Now spells out the cause and consequence. */}
      {ackRequired && !alreadyCompleted && !dwellDone && (
        <div
          className="mb-2 flex items-center gap-3 rounded-md border border-info/60 bg-info-subtle px-3 py-2"
          title="Background tabs don't count. Keep this page visible while you read."
        >
          <Clock className="h-4 w-4 flex-shrink-0 text-info" aria-hidden="true" />
          <span className="text-xs font-medium text-info">
            Acknowledge unlocks in <span className="font-mono font-semibold tabular-nums">{dwellMmSs}</span>
            <span className="hidden text-info/80 sm:inline"> (keep this tab open while you read)</span>
          </span>
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-info/15"
            role="progressbar"
            aria-valuenow={dwellPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Reading time progress"
          >
            <div
              className="h-full bg-info transition-[width] duration-100 ease-linear"
              style={{ width: `${dwellPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Inline PDF render of the original Word document. Height uses dvh
          so it scales with the viewport on mobile too — and now consumes
          the full available area minus the slim header bar + footer. */}
      <div
        className="mb-4 overflow-hidden rounded-lg border border-border bg-surface"
        style={{ height: "calc(100dvh - 9rem)", minHeight: "40rem" }}
      >
        <iframe
          src={pdfSrc}
          title={`${documentTitle} · v${sourceVersion}`}
          className="h-full w-full"
          // sandbox intentionally omitted: we serve the PDF from our own
          // origin via the SharePoint proxy, so same-origin rules apply.
        />
      </div>

      {/* Attestation block. Hidden entirely on re-visit of a completed
          lesson — the ack is already banked. Also hidden in read-only mode
          (public library at /policies). */}
      {ackRequired && !alreadyCompleted && (
        <section
          aria-label="Acknowledgement"
          className="mb-6 rounded-lg border border-border bg-surface p-4"
        >
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-md p-2 -m-2 ${
              dwellDone ? "hover:bg-surface-muted" : "opacity-60 cursor-not-allowed"
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed"
              checked={attested}
              disabled={!dwellDone}
              onChange={(e) => setAttested(e.target.checked)}
              aria-describedby={`attest-desc-${lessonId}`}
            />
            <span className="text-sm">
              <span
                className="font-medium text-foreground"
                // Title shows the exact plain-text the audit snapshot
                // captures, so admins can confirm the rendered statement
                // and the stored evidence are identical.
                title={formatPolicyAttestation(documentTitle, sourceVersion)}
              >
                I have read and understood{" "}
                <span className="font-semibold">{documentTitle}</span> v{sourceVersion}.
              </span>
              <span
                id={`attest-desc-${lessonId}`}
                className="mt-1 block text-xs text-foreground-muted"
              >
                {!dwellDone ? (
                  <>
                    <span className="font-medium text-info">Locked for {dwellMmSs} more</span>
                    {" "}Finish the required reading time above, then tick this box to enable Acknowledge.
                  </>
                ) : (
                  <>Your attestation, the version, and a content hash are stored as audit evidence.</>
                )}
              </span>
            </span>
          </label>

          {unlocked && (
            <p className="mt-3 flex items-center gap-2 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Ready to acknowledge. Use the button below.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-foreground-muted">{label}:</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function DisclosureButton({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
      aria-expanded={open}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}

function RevisionTable({ rows }: { rows: RevisionRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="text-foreground-muted">
          <tr>
            <Th>Date</Th>
            <Th>Final v</Th>
            <Th>Description</Th>
            <Th>Approved by</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <Td>{r.date ?? "—"}</Td>
              <Td>{r.finalVersion ?? r.initialVersion ?? "—"}</Td>
              <Td>{r.description ?? "—"}</Td>
              <Td>{r.approvedBy ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewTable({ rows }: { rows: ReviewRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="text-foreground-muted">
          <tr>
            <Th>Date</Th>
            <Th>Reviewed v</Th>
            <Th>Changes?</Th>
            <Th>Reviewed by</Th>
            <Th>Approved by</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <Td>{r.date ?? "—"}</Td>
              <Td>{r.reviewedVersion ?? "—"}</Td>
              <Td>{r.changesRequired ?? "—"}</Td>
              <Td>{r.reviewedBy ?? "—"}</Td>
              <Td>{r.approvedBy ?? "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1.5 text-left font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 text-foreground">{children}</td>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
