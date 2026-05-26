"use client";

/**
 * Admin surface for curating the public ISO doc library at /policies.
 *
 * Add via SharePoint picker (filtered to .docx) or paste-share-link. Each
 * row exposes reorder / re-sync / remove. Removing only severs the LMS
 * pointer — the SharePoint file is untouched.
 */

import { useCallback, useEffect, useState } from "react";
import { SharePointFilePicker } from "@/components/courses/SharePointFilePicker";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";

interface PublicIsoDocRow {
  id: string;
  sharePointDriveId: string;
  sharePointItemId: string;
  sharePointWebUrl: string;
  documentTitle: string;
  documentCode: string | null;
  sourceVersion: string;
  sourceLastModified: string;
  approver: string | null;
  approvedOn: string | null;
  lastReviewedOn: string | null;
  sortOrder: number;
  publishedAt: string;
  lastSyncedAt: string;
  lastSyncedBy: { name: string | null; email: string } | null;
  viewCount: number;
  distinctViewers: number;
}

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

interface AvailableLesson {
  policyDocLessonId: string;
  documentTitle: string;
  documentCode: string | null;
  sourceVersion: string;
  courseTitle: string;
  lessonTitle: string;
}

export function PublicIsoLibraryManager() {
  const [rows, setRows] = useState<PublicIsoDocRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lessonPickerOpen, setLessonPickerOpen] = useState(false);
  const [availableLessons, setAvailableLessons] = useState<AvailableLesson[] | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState("");

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/public-iso-docs");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as { docs: PublicIsoDocRow[] };
      setRows(data.docs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addByPointer = useCallback(
    async (driveId: string, itemId: string) => {
      setAdding(true);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch("/api/admin/public-iso-docs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ driveId, itemId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Failed (${res.status})`);
        }
        setMessage("Added.");
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Add failed");
      } finally {
        setAdding(false);
      }
    },
    [refresh],
  );

  const handlePickerSelect = useCallback(
    (ref: SharePointDocumentRef) => {
      setPickerOpen(false);
      void addByPointer(ref.driveId, ref.itemId);
    },
    [addByPointer],
  );

  const openLessonPicker = useCallback(async () => {
    setLessonPickerOpen(true);
    setAvailableLessons(null);
    setSelectedLessonId("");
    setError(null);
    try {
      const res = await fetch("/api/admin/public-iso-docs/from-lesson");
      if (!res.ok) throw new Error(`Failed to load lessons (${res.status})`);
      const data = (await res.json()) as { available: AvailableLesson[] };
      setAvailableLessons(data.available);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lessons");
      setAvailableLessons([]);
    }
  }, []);

  const addFromLesson = useCallback(async () => {
    if (!selectedLessonId) return;
    setAdding(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/public-iso-docs/from-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyDocLessonId: selectedLessonId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed (${res.status})`);
      }
      setMessage("Added from existing lesson.");
      setLessonPickerOpen(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setAdding(false);
    }
  }, [selectedLessonId, refresh]);

  const handleResolveLink = useCallback(async () => {
    const url = shareUrl.trim();
    if (!url) return;
    setResolving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/policy-doc/resolve-share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareUrl: url }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        driveId?: string;
        itemId?: string;
        error?: string;
      };
      if (!res.ok || !data.driveId || !data.itemId) {
        throw new Error(data.error ?? `Could not resolve link (${res.status})`);
      }
      setShareUrl("");
      await addByPointer(data.driveId, data.itemId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve link");
    } finally {
      setResolving(false);
    }
  }, [shareUrl, addByPointer]);

  const resync = useCallback(
    async (id: string) => {
      setBusyId(id);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch(`/api/admin/public-iso-docs/${id}/sync`, {
          method: "POST",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Sync failed (${res.status})`);
        }
        const data = (await res.json()) as { status: string };
        setMessage(
          data.status === "noop" ? "Already up to date." : "Synced.",
        );
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sync failed");
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!confirm("Remove this document from the public library?")) return;
      setBusyId(id);
      setError(null);
      setMessage(null);
      try {
        const res = await fetch(`/api/admin/public-iso-docs/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        setMessage("Removed.");
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Remove failed");
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const move = useCallback(
    async (id: string, direction: -1 | 1) => {
      if (!rows) return;
      const idx = rows.findIndex((r) => r.id === id);
      const swapIdx = idx + direction;
      if (idx < 0 || swapIdx < 0 || swapIdx >= rows.length) return;
      const a = rows[idx];
      const b = rows[swapIdx];
      // Swap the two rows' sortOrder values. If they're equal (e.g. all
      // defaults), bump the target one above/below the other.
      const aNext = b.sortOrder === a.sortOrder ? a.sortOrder + direction : b.sortOrder;
      const bNext = b.sortOrder === a.sortOrder ? a.sortOrder : a.sortOrder;

      setBusyId(id);
      try {
        await Promise.all([
          fetch(`/api/admin/public-iso-docs/${a.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: aNext }),
          }),
          fetch(`/api/admin/public-iso-docs/${b.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sortOrder: bNext }),
          }),
        ]);
        await refresh();
      } finally {
        setBusyId(null);
      }
    },
    [rows, refresh],
  );

  if (rows === null) {
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground-muted">
        Loading library…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add */}
      <div className="rounded-lg border border-border bg-surface p-3 space-y-3">
        <p className="text-xs font-medium text-foreground-muted">
          Add a Word document (.docx) from SharePoint
        </p>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={shareUrl}
            onChange={(e) => setShareUrl(e.target.value)}
            placeholder="Paste SharePoint link"
            disabled={adding || resolving}
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleResolveLink();
              }
            }}
          />
          <button
            type="button"
            onClick={() => void handleResolveLink()}
            disabled={!shareUrl.trim() || adding || resolving}
            className="rounded-md bg-primary text-primary-foreground text-xs px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
          >
            {resolving ? "Resolving…" : adding ? "Adding…" : "Add link"}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={adding || resolving}
            className="rounded-md border border-border text-xs text-foreground px-3 py-1.5 hover:bg-surface-muted disabled:opacity-50"
          >
            Browse…
          </button>
          <button
            type="button"
            onClick={() => void openLessonPicker()}
            disabled={adding || resolving}
            className="rounded-md border border-border text-xs text-foreground px-3 py-1.5 hover:bg-surface-muted disabled:opacity-50"
          >
            From lesson…
          </button>
        </div>
      </div>

      {lessonPickerOpen && (
        <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
          <p className="text-xs font-medium text-foreground">
            Add an existing POLICY_DOC lesson to the library
          </p>
          {availableLessons === null ? (
            <p className="text-xs text-foreground-muted">Loading lessons…</p>
          ) : availableLessons.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              No POLICY_DOC lessons available to add (or all are already in the library).
            </p>
          ) : (
            <select
              value={selectedLessonId}
              onChange={(e) => setSelectedLessonId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Choose a lesson…</option>
              {availableLessons.map((l) => (
                <option key={l.policyDocLessonId} value={l.policyDocLessonId}>
                  {(l.documentCode ? `${l.documentCode} · ` : "") +
                    l.documentTitle +
                    ` v${l.sourceVersion}` +
                    ` — ${l.courseTitle} / ${l.lessonTitle}`}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void addFromLesson()}
              disabled={!selectedLessonId || adding}
              className="rounded-md bg-primary text-primary-foreground text-xs px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add to library"}
            </button>
            <button
              type="button"
              onClick={() => setLessonPickerOpen(false)}
              className="rounded-md border border-border text-xs text-foreground px-3 py-1.5 hover:bg-surface-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && <p className="text-xs text-foreground-muted">{message}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}

      {/* List */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-foreground-muted">
          No documents in the public library yet.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {rows.map((row, idx) => (
            <li key={row.id} className="flex items-start gap-3 p-3">
              <div className="flex flex-col gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => void move(row.id, -1)}
                  disabled={idx === 0 || busyId === row.id}
                  aria-label="Move up"
                  className="rounded border border-border px-1.5 text-xs text-foreground-muted hover:bg-surface-muted disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => void move(row.id, 1)}
                  disabled={idx === rows.length - 1 || busyId === row.id}
                  aria-label="Move down"
                  className="rounded border border-border px-1.5 text-xs text-foreground-muted hover:bg-surface-muted disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {row.documentTitle}
                </p>
                <p className="text-xs text-foreground-muted">
                  {row.documentCode ? `${row.documentCode} · ` : ""}
                  v{row.sourceVersion}
                  {row.approver ? ` · approved by ${row.approver}` : ""}
                </p>
                <p className="text-xs text-foreground-subtle mt-1">
                  Last synced {formatRel(row.lastSyncedAt)}
                  {row.lastSyncedBy?.name ? ` by ${row.lastSyncedBy.name}` : ""}
                  {" · "}
                  {row.viewCount} view{row.viewCount === 1 ? "" : "s"}
                  {row.distinctViewers > 0
                    ? ` from ${row.distinctViewers} ${row.distinctViewers === 1 ? "person" : "people"}`
                    : ""}
                  {" · "}
                  <a
                    href={row.sharePointWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Open in SharePoint ↗
                  </a>
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void resync(row.id)}
                  disabled={busyId === row.id}
                  className="rounded-md border border-border text-xs text-foreground px-2.5 py-1 hover:bg-surface-muted disabled:opacity-50"
                >
                  {busyId === row.id ? "…" : "Re-sync"}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(row.id)}
                  disabled={busyId === row.id}
                  className="rounded-md border border-border text-xs text-danger px-2.5 py-1 hover:bg-danger-subtle disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SharePointFilePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        mimeTypeFilter={(m) => m === DOCX_MIME}
        filterLabel="Word documents (.docx)"
      />
    </div>
  );
}

function formatRel(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}
