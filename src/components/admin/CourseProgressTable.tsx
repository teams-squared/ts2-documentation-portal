"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ProgressBar } from "@/components/app/ProgressBar";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
} from "@/components/icons";
import { useListMorph } from "@/hooks/useListMorph";
import type { CourseSegment, StudentRow } from "@/lib/courseProgress";

interface Props {
  segments: CourseSegment[];
}

type Filtered = CourseSegment & {
  matchedRows: StudentRow[];
  courseMatch: boolean;
};

export function CourseProgressTable({ segments }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const morph = useListMorph();

  const q = query.trim().toLowerCase();
  const filtered = useMemo<Filtered[]>(() => {
    if (!q) {
      return segments.map((s) => ({
        ...s,
        matchedRows: s.rows,
        courseMatch: true,
      }));
    }
    const out: Filtered[] = [];
    for (const s of segments) {
      const courseMatch = s.title.toLowerCase().includes(q);
      const rowMatches = s.rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q),
      );
      if (courseMatch || rowMatches.length > 0) {
        out.push({
          ...s,
          matchedRows: courseMatch ? s.rows : rowMatches,
          courseMatch,
        });
      }
    }
    return out;
  }, [segments, q]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="relative mb-4">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            morph(() => setQuery(next));
          }}
          placeholder="Search courses or students…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-surface text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface shadow-sm p-6 text-center text-sm text-foreground-muted">
          {q ? "No matches." : "No courses to show."}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left bg-surface-muted border-b border-border">
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted w-8" />
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                    Course
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted text-right">
                    Enrolled
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted text-right">
                    Completed
                  </th>
                  <th className="px-4 py-2 text-xs font-medium text-foreground-muted text-right">
                    Overdue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((seg) => {
                  const isOpen = q ? true : expanded.has(seg.courseId);
                  return (
                    <CourseRow
                      key={seg.courseId}
                      segment={seg}
                      isOpen={isOpen}
                      onToggle={() => toggle(seg.courseId)}
                      searchActive={!!q}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CourseRow({
  segment,
  isOpen,
  onToggle,
  searchActive,
}: {
  segment: Filtered;
  isOpen: boolean;
  onToggle: () => void;
  searchActive: boolean;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer hover:bg-surface-muted transition-colors"
      >
        <td className="px-4 py-3 align-middle">
          {isOpen ? (
            <ChevronDownIcon className="w-4 h-4 text-foreground-muted" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-foreground-muted" />
          )}
        </td>
        <td className="px-4 py-3 align-middle">
          <p className="text-sm font-medium text-foreground">{segment.title}</p>
          <p className="text-xs text-foreground-subtle mt-0.5">
            {segment.totalLessons} lesson
            {segment.totalLessons === 1 ? "" : "s"}
          </p>
        </td>
        <td className="px-4 py-3 text-right text-foreground tabular-nums">
          {segment.enrolledCount}
        </td>
        <td className="px-4 py-3 text-right text-foreground tabular-nums">
          {segment.completedCount}
        </td>
        <td className="px-4 py-3 text-right">
          {segment.overdueCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger">
              <AlertTriangleIcon className="w-3 h-3" />
              {segment.overdueCount}
            </span>
          ) : (
            <span className="text-xs text-foreground-subtle">—</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-surface-muted/40">
          <td colSpan={5} className="px-4 py-4">
            <ExpandedRows
              courseId={segment.courseId}
              rows={segment.matchedRows}
              filteredBySearch={searchActive && !segment.courseMatch}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedRows({
  courseId,
  rows,
  filteredBySearch,
}: {
  courseId: string;
  rows: StudentRow[];
  filteredBySearch: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-foreground-muted px-1">No enrollments yet.</p>
    );
  }

  return (
    <div>
      {filteredBySearch && (
        <p className="text-xs text-foreground-subtle mb-2 px-1">
          Showing students matching search.
        </p>
      )}
      <div className="rounded-md border border-border bg-surface overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left bg-surface-muted">
              <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                Student
              </th>
              <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                Progress
              </th>
              <th className="px-4 py-2 text-xs font-medium text-foreground-muted">
                Overdue lessons
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.userId}>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      name={row.name}
                      image={row.avatar}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {row.name}
                      </p>
                      <p className="text-xs text-foreground-muted truncate">
                        {row.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 align-top w-[18rem]">
                  {row.enrollmentCompleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-xs font-medium text-success">
                      <CheckCircleIcon className="w-3 h-3" />
                      Completed
                    </span>
                  ) : row.completedLessons === 0 ? (
                    <span className="text-xs text-foreground-muted">
                      Not started
                    </span>
                  ) : (
                    <ProgressBar
                      value={row.percent}
                      label={`${row.name} progress`}
                      caption={`${row.completedLessons} of ${row.totalLessons} lessons`}
                      showPercent
                    />
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  {row.overdueLessons.length === 0 ? (
                    <span className="text-xs text-foreground-subtle">—</span>
                  ) : (
                    <div className="space-y-2">
                      <details>
                        <summary className="cursor-pointer list-none inline-flex items-center gap-1 rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger">
                          <AlertTriangleIcon className="w-3 h-3" />
                          {row.overdueLessons.length} overdue
                        </summary>
                        <ul className="mt-2 ml-1 space-y-0.5 text-xs text-foreground-muted">
                          {row.overdueLessons.map((title) => (
                            <li key={title}>· {title}</li>
                          ))}
                        </ul>
                      </details>
                      <RemindButton
                        courseId={courseId}
                        userId={row.userId}
                        learnerName={row.name}
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const NOTE_MAX = 500;

function RemindButton({
  courseId,
  userId,
  learnerName,
}: {
  courseId: string;
  userId: string;
  learnerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "success"; at: Date; count: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setStatus({ kind: "idle" });
    try {
      const res = await fetch(`/api/admin/courses/${courseId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        lessonCount?: number;
      };
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: data.error ?? `Failed (${res.status})`,
        });
      } else {
        setStatus({
          kind: "success",
          at: new Date(),
          count: data.lessonCount ?? 0,
        });
        setOpen(false);
        setNote("");
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded-sm px-1"
        >
          Send reminder
        </button>
        {status.kind === "success" && (
          <span className="text-xs text-success">
            Sent {status.count} lesson{status.count === 1 ? "" : "s"}
          </span>
        )}
        {status.kind === "error" && (
          <span className="text-xs text-danger">{status.message}</span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
        placeholder={`Optional note to ${learnerName}…`}
        rows={3}
        className="w-full text-xs rounded-md border border-border bg-surface px-2 py-1.5 text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={sending}
          className="text-xs font-medium rounded-md bg-primary text-primary-foreground px-2.5 py-1 hover:opacity-90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {sending ? "Sending…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setNote("");
          }}
          disabled={sending}
          className="text-xs font-medium rounded-md border border-border text-foreground-muted px-2.5 py-1 hover:bg-surface-muted disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Cancel
        </button>
        <span className="text-xs text-foreground-subtle ml-auto tabular-nums">
          {note.length}/{NOTE_MAX}
        </span>
      </div>
      {status.kind === "error" && (
        <p className="text-xs text-danger">{status.message}</p>
      )}
    </form>
  );
}
