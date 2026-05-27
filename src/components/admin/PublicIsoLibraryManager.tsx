"use client";

/**
 * Admin surface for curating the public ISO doc library at /policies.
 *
 * Add via SharePoint picker (filtered to .docx) or paste-share-link. Each
 * row exposes reorder / re-sync / remove. Removing only severs the LMS
 * pointer — the SharePoint file is untouched.
 */

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SharePointFilePicker } from "@/components/courses/SharePointFilePicker";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/Sortable";

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
  isHidden: boolean;
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

  // Bulk reorder driven by the drag-and-drop list. We assign each row a
  // fresh sortOrder index and PATCH every row whose value changed; PATCH
  // calls are fire-in-parallel since the endpoint is idempotent.
  const reorder = useCallback(
    async (next: PublicIsoDocRow[]) => {
      if (!rows) return;
      const previous = rows;
      const renumbered = next.map((r, i) => ({ ...r, sortOrder: i }));
      setRows(renumbered);
      try {
        const changed = renumbered.filter((r, i) => previous[i]?.id !== r.id);
        await Promise.all(
          changed.map((r) =>
            fetch(`/api/admin/public-iso-docs/${r.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sortOrder: r.sortOrder }),
            }),
          ),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reorder failed");
        setRows(previous);
      }
    },
    [rows],
  );

  const toggleHidden = useCallback(
    async (id: string) => {
      if (!rows) return;
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      const next = !row.isHidden;
      // Optimistic flip
      setRows(rows.map((r) => (r.id === id ? { ...r, isHidden: next } : r)));
      setMessage(null);
      setError(null);
      try {
        const res = await fetch(`/api/admin/public-iso-docs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isHidden: next }),
        });
        if (!res.ok) throw new Error(`Update failed (${res.status})`);
        setMessage(next ? "Hidden from /policies." : "Visible on /policies.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
        await refresh();
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
        <SortableList
          items={rows}
          onReorder={(next) => void reorder(next)}
          className="divide-y divide-border rounded-lg border border-border bg-surface"
        >
          {(row) => (
            <SortableItem key={row.id} id={row.id}>
              {({ setNodeRef, style, dragHandleProps }) => (
                <div
                  ref={setNodeRef}
                  style={style}
                  className={`flex items-start gap-3 bg-surface p-3 ${row.isHidden ? "opacity-60" : ""}`}
                >
                  <DragHandle
                    dragHandleProps={dragHandleProps}
                    label={`Drag ${row.documentTitle}`}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {row.documentTitle}
                      {row.isHidden && (
                        <span className="ml-2 inline-flex items-center rounded-md border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted">
                          Hidden
                        </span>
                      )}
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
                      onClick={() => void toggleHidden(row.id)}
                      disabled={busyId === row.id}
                      aria-label={row.isHidden ? `Unhide ${row.documentTitle}` : `Hide ${row.documentTitle}`}
                      title={row.isHidden ? "Unhide — show on /policies" : "Hide from /policies"}
                      className="rounded-md border border-border p-1.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                    >
                      {row.isHidden ? (
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
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
                </div>
              )}
            </SortableItem>
          )}
        </SortableList>
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
