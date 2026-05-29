import Link from "next/link";
import { ChevronRight, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

interface NextStepBannerProps {
  courseTitle: string;
  lessonTitle: string;
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  continueUrl: string;
  isOverdue: boolean;
}

function getNudge(percent: number, isOverdue: boolean): string {
  if (isOverdue) return "This lesson is overdue. Let's get it done.";
  if (percent === 0) return "Kick things off and earn your first XP.";
  if (percent < 25) return "You've started strong. Keep the momentum going.";
  if (percent < 50) return "You're getting there, one step at a time.";
  if (percent < 75) return `You're ${percent}% of the way. More than halfway!`;
  if (percent < 100) return "Almost there. Push through to finish!";
  return "Course complete. Amazing work!";
}

export function NextStepBanner({
  courseTitle,
  lessonTitle,
  completedLessons,
  totalLessons,
  percentComplete,
  continueUrl,
  isOverdue,
}: NextStepBannerProps) {
  const nudge = getNudge(percentComplete, isOverdue);
  const nextLessonNumber = completedLessons + 1;

  return (
    <section className="animate-fade-in">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
        Pick up where you left off
      </p>
      <Link
        href={continueUrl}
        className={cn(
          "group relative block overflow-hidden rounded-lg bg-card p-5 shadow-sm transition-all hover:shadow-md sm:p-6",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isOverdue
            ? "border-y border-r border-l-4 border-y-border border-r-border border-l-danger"
            : "border border-border hover:border-border-strong",
        )}
      >
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              {isOverdue && (
                <AlertTriangle
                  className="h-4 w-4 shrink-0 text-danger animate-pulse-attention"
                  aria-hidden="true"
                />
              )}
              <h2 className="truncate font-display text-base font-semibold text-foreground transition-colors group-hover:text-primary sm:text-lg">
                {courseTitle}
              </h2>
            </div>
            <p className="mb-1 truncate text-sm text-foreground-muted">
              <span className="mr-1.5 text-xs font-medium uppercase tracking-wider text-primary">
                Lesson {nextLessonNumber}/{totalLessons}
              </span>
              {lessonTitle}
            </p>
            <p
              className={cn(
                "mb-3 text-xs",
                isOverdue
                  ? "font-medium text-danger"
                  : "text-foreground-subtle",
              )}
            >
              {nudge}
            </p>
            <div className="flex items-center gap-3">
              <div
                className="relative h-2 flex-1 overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-label={`${courseTitle} progress`}
                aria-valuenow={percentComplete}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-[400ms] ease-out"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-medium tabular-nums text-foreground-subtle">
                {completedLessons}/{totalLessons}
              </span>
            </div>
          </div>
          <span className="inline-flex w-full sm:w-auto shrink-0 justify-center items-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors group-hover:bg-primary-hover sm:px-5">
            Continue
            <ChevronRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </span>
        </div>
      </Link>
    </section>
  );
}
