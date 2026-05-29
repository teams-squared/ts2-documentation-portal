"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface AckRow {
  id: string;
  acknowledgedAt: string | null;
  employee: { id: string; name: string | null; email: string };
  courseTitle: string;
  documentTitle: string;
  documentCode: string | null;
  documentVersion: string | null;
  auditHash: string | null;
  auditETag: string | null;
  attestationText: string | null;
  dwellSeconds: number | null;
  sourceItemId: string | null;
}

interface ListResponse {
  acks: AckRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

type Preset = "30d" | "90d" | "all";

/** Returns ISO date strings (YYYY-MM-DD, in local TZ) for a quick preset. */
function presetRange(preset: Preset): { from: string; to: string } {
  if (preset === "all") return { from: "", to: "" };
  const days = preset === "30d" ? 30 : 90;
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return {
    from: toInputDate(from),
    to: toInputDate(today),
  };
}

function toInputDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Builds the query string for both list + export endpoints. `from` is
 *  inclusive at start-of-day; `to` is inclusive at end-of-day. */
function buildQuery({
  from,
  to,
  page,
  pageSize,
}: {
  from: string;
  to: string;
  page?: number;
  pageSize?: number;
}): string {
  const qs = new URLSearchParams();
  if (from) qs.set("from", `${from}T00:00:00.000Z`);
  if (to) qs.set("to", `${to}T23:59:59.999Z`);
  if (page) qs.set("page", String(page));
  if (pageSize) qs.set("pageSize", String(pageSize));
  return qs.toString();
}

export function IsoAckLog() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery({ from, to, page, pageSize: PAGE_SIZE });
      const res = await fetch(`/api/admin/iso-acks${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Failed (${res.status})`,
        );
      }
      const payload = (await res.json()) as ListResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPreset = (preset: Preset) => {
    const r = presetRange(preset);
    setFrom(r.from);
    setTo(r.to);
    setPage(1);
  };

  const onFilterChange = (next: { from?: string; to?: string }) => {
    if (next.from !== undefined) setFrom(next.from);
    if (next.to !== undefined) setTo(next.to);
    setPage(1);
  };

  const exportHref = `/api/admin/iso-acks/export${
    from || to ? `?${buildQuery({ from, to })}` : ""
  }`;

  const total = data?.total ?? 0;
  const totalPages = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE);
  const showingFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-3 px-4 py-3 rounded-lg border border-border bg-surface-muted">
        <div className="w-full sm:w-auto">
          <label
            htmlFor="iso-ack-from"
            className="block text-xs font-medium text-foreground-muted mb-1"
          >
            From
          </label>
          <input
            id="iso-ack-from"
            type="date"
            value={from}
            onChange={(e) => onFilterChange({ from: e.target.value })}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label
            htmlFor="iso-ack-to"
            className="block text-xs font-medium text-foreground-muted mb-1"
          >
            To
          </label>
          <input
            id="iso-ack-to"
            type="date"
            value={to}
            onChange={(e) => onFilterChange({ to: e.target.value })}
            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => applyPreset("30d")}
          >
            Last 30 days
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => applyPreset("90d")}
          >
            Last 90 days
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => applyPreset("all")}
          >
            All time
          </Button>
        </div>
        <div className="flex-1" />
        <a
          href={exportHref}
          download
          className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          Download CSV
        </a>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between text-xs text-foreground-muted">
        <span>
          {loading
            ? "Loading…"
            : total === 0
              ? "No acknowledgements in this range."
              : `Showing ${showingFrom}–${showingTo} of ${total}`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-left">
            <tr className="text-xs uppercase tracking-wide text-foreground-muted">
              <th className="px-4 py-2 font-medium">Acknowledged</th>
              <th className="px-4 py-2 font-medium">Employee</th>
              <th className="px-4 py-2 font-medium">Course</th>
              <th className="px-4 py-2 font-medium">Document</th>
              <th className="px-4 py-2 font-medium">Version</th>
              <th className="px-4 py-2 font-medium">Dwell</th>
              <th className="px-4 py-2 font-medium">Audit hash</th>
            </tr>
          </thead>
          <tbody>
            {!loading && data && data.acks.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-foreground-muted"
                >
                  No acknowledgements match these filters.
                </td>
              </tr>
            )}
            {data?.acks.map((row) => {
              const attestTitle = [
                row.attestationText,
                row.sourceItemId ? `SharePoint item: ${row.sourceItemId}` : null,
              ]
                .filter(Boolean)
                .join("\n");
              return (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-2 text-foreground whitespace-nowrap">
                    {row.acknowledgedAt
                      ? new Date(row.acknowledgedAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-foreground">
                    <div className="font-medium">
                      {row.employee.name ?? row.employee.email}
                    </div>
                    {row.employee.name && (
                      <div className="text-xs text-foreground-muted">
                        {row.employee.email}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-foreground">{row.courseTitle}</td>
                  <td
                    className="px-4 py-2 text-foreground"
                    title={attestTitle || undefined}
                  >
                    <div>{row.documentTitle}</div>
                    {row.documentCode && (
                      <div className="text-xs text-foreground-muted">
                        {row.documentCode}
                      </div>
                    )}
                    {row.attestationText && (
                      <div className="text-xs text-foreground-muted italic mt-0.5 max-w-[20rem] truncate">
                        “{row.attestationText}”
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-foreground">
                    {row.documentVersion ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-foreground-muted whitespace-nowrap text-xs tabular-nums">
                    {row.dwellSeconds != null
                      ? `${Math.floor(row.dwellSeconds / 60)}m ${row.dwellSeconds % 60}s`
                      : "—"}
                  </td>
                  <td
                    className="px-4 py-2 text-foreground-muted font-mono text-xs max-w-[14rem] truncate"
                    title={row.auditHash ?? ""}
                  >
                    {row.auditHash ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
