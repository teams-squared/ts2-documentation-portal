"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { DeadlineStatus } from "@/lib/deadlines";

interface DeadlineItem {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  status: DeadlineStatus;
  relativeText: string;
}

interface DeadlineAlertsProps {
  deadlines: DeadlineItem[];
}

const statusConfig: Record<
  string,
  { borderClass: string; bgClass: string; badgeClass: string }
> = {
  overdue: {
    borderClass: "border-l-4 border-l-danger",
    bgClass: "bg-danger-subtle/40",
    badgeClass: "bg-danger-subtle text-danger",
  },
  "due-soon": {
    borderClass: "border-l-4 border-l-warning",
    bgClass: "bg-warning-subtle/40",
    badgeClass: "bg-warning-subtle text-warning",
  },
  upcoming: {
    borderClass: "",
    bgClass: "",
    badgeClass: "bg-surface-muted text-foreground-muted",
  },
};

function DeadlineRow({ item }: { item: DeadlineItem }) {
  const config = statusConfig[item.status] || statusConfig.upcoming;
  return (
    <Link
      href={`/courses/${item.courseId}/lessons/${item.lessonId}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        config.borderClass,
        config.bgClass,
      )}
    >
      <div className="shrink-0">
        {item.status === "overdue" ? (
          <AlertTriangle
            className="h-4 w-4 text-danger animate-pulse-attention"
            aria-hidden="true"
          />
        ) : (
          <Clock
            className={cn(
              "h-4 w-4",
              item.status === "due-soon"
                ? "text-warning"
                : "text-foreground-subtle",
            )}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className="truncate text-sm font-medium text-foreground">
          {item.lessonTitle}
        </p>
        <span className="shrink-0 text-xs text-foreground-subtle">·</span>
        <p className="truncate text-xs text-foreground-muted">
          {item.courseTitle}
        </p>
      </div>
      <span
        className={cn(
          "inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
          config.badgeClass,
        )}
      >
        {item.relativeText}
      </span>
    </Link>
  );
}

export function DeadlineAlerts({ deadlines }: DeadlineAlertsProps) {
  const [showUpcoming, setShowUpcoming] = useState(false);

  const urgent = deadlines.filter(
    (d) => d.status === "overdue" || d.status === "due-soon",
  );
  const upcoming = deadlines.filter((d) => d.status === "upcoming");

  // Nothing scheduled at all — no section to show.
  if (deadlines.length === 0) return null;

  // No pressing deadlines: render a quiet "on track" confirmation instead of
  // letting the section vanish, so learners get positive feedback. Upcoming
  // items stay tucked behind the expander.
  if (urgent.length === 0) {
    return (
      <section className="animate-fade-in" style={{ animationDelay: "100ms" }}>
        <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          Deadlines
        </h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
            <p className="text-sm text-foreground-muted">
              {upcoming.length > 0
                ? "You're on track. Nothing due soon."
                : "You're on track. No deadlines right now."}
            </p>
          </div>
          {showUpcoming &&
            upcoming.map((item) => (
              <div key={item.lessonId} className="border-t border-border">
                <DeadlineRow item={item} />
              </div>
            ))}
          {upcoming.length > 0 && (
            <button
              type="button"
              onClick={() => setShowUpcoming((v) => !v)}
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-xs font-medium text-foreground-muted transition-colors",
                "hover:bg-surface-muted hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              )}
            >
              {showUpcoming ? (
                <>
                  Hide upcoming
                  <ChevronUp className="h-3 w-3" aria-hidden="true" />
                </>
              ) : (
                <>
                  {upcoming.length} upcoming
                  <ChevronDown className="h-3 w-3" aria-hidden="true" />
                </>
              )}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className="animate-fade-in"
      style={{ animationDelay: "100ms" }}
    >
      <h2 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Needs your attention
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="divide-y divide-border">
          {urgent.map((item) => (
            <DeadlineRow key={item.lessonId} item={item} />
          ))}
          {showUpcoming &&
            upcoming.map((item) => (
              <DeadlineRow key={item.lessonId} item={item} />
            ))}
        </div>
        {upcoming.length > 0 && (
          <button
            type="button"
            onClick={() => setShowUpcoming((v) => !v)}
            className={cn(
              "inline-flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-xs font-medium text-foreground-muted transition-colors",
              "hover:bg-surface-muted hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            )}
          >
            {showUpcoming ? (
              <>
                Hide upcoming
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              </>
            ) : (
              <>
                {upcoming.length} more upcoming
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
