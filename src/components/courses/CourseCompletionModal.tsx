"use client";

import Link from "next/link";
import { CheckCircleIcon } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

interface CourseCompletionStats {
  totalLessons: number;
  completedLessons: number;
  xpEarned: number;
  daysTaken: number;
}

interface CourseCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseTitle: string;
  stats: CourseCompletionStats;
}

/** 8 confetti dots, absolutely positioned, CSS-only animation.
 *  Wrapped in motion-safe: so prefers-reduced-motion disables them. */
const CONFETTI_DOTS = [
  { color: "bg-primary",        top: "10%", left: "15%",  delay: "0ms" },
  { color: "bg-success",        top: "8%",  left: "75%",  delay: "120ms" },
  { color: "bg-warning",        top: "20%", left: "88%",  delay: "60ms" },
  { color: "bg-primary",        top: "5%",  left: "50%",  delay: "200ms" },
  { color: "bg-danger",         top: "15%", left: "30%",  delay: "80ms" },
  { color: "bg-success",        top: "12%", left: "60%",  delay: "160ms" },
  { color: "bg-warning",        top: "18%", left: "5%",   delay: "40ms" },
  { color: "bg-primary",        top: "6%",  left: "92%",  delay: "220ms" },
] as const;

export function CourseCompletionModal({
  open,
  onOpenChange,
  courseId,
  courseTitle,
  stats,
}: CourseCompletionModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md overflow-hidden"
        data-testid="course-completion-modal"
      >
        {/* CSS-only confetti dots — hidden when prefers-reduced-motion is set */}
        <div aria-hidden="true" className="pointer-events-none">
          {CONFETTI_DOTS.map((dot, i) => (
            <span
              key={i}
              className={`motion-safe:animate-confetti-fall absolute h-2 w-2 rounded-full ${dot.color}`}
              style={{ top: dot.top, left: dot.left, animationDelay: dot.delay }}
            />
          ))}
        </div>

        {/* Screen-reader live region */}
        <div className="sr-only" aria-live="polite">
          Course complete. You finished {stats.completedLessons} lesson{stats.completedLessons !== 1 ? "s" : ""}.
        </div>

        <div className="flex flex-col items-center text-center gap-6 py-2">
          {/* Gradient disc with CheckCircle icon */}
          <div
            className="motion-safe:animate-pulse-glow flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, oklch(0.95 0.06 150), oklch(0.97 0.013 296))",
            }}
          >
            <CheckCircleIcon className="h-10 w-10 text-success" aria-hidden="true" />
          </div>

          <DialogHeader className="items-center gap-1.5">
            <DialogTitle className="font-display text-2xl font-bold text-foreground">
              Course complete!
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-foreground-muted">
                {courseTitle}
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* Stat tiles — numerics tween via <AnimatedNumber> for the
              celebration beat. The +X XP tile prepends its sign manually
              and animates only the integer. */}
          <div className="grid grid-cols-3 gap-3 w-full">
            <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-muted px-3 py-4">
              <span className="text-2xl font-bold text-foreground">
                <AnimatedNumber value={stats.completedLessons} />
              </span>
              <span className="text-xs text-foreground-muted">
                Lesson{stats.completedLessons !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-muted px-3 py-4">
              <span className="text-2xl font-bold text-primary tabular-nums">
                +
                <AnimatedNumber value={stats.xpEarned} />
              </span>
              <span className="text-xs text-foreground-muted">XP</span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-muted px-3 py-4">
              <span className="text-2xl font-bold text-foreground">
                <AnimatedNumber value={stats.daysTaken} />
              </span>
              <span className="text-xs text-foreground-muted">
                Day{stats.daysTaken !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Back to dashboard
            </Link>
            <Link
              href={`/courses/${courseId}`}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center justify-center rounded-md border border-border-strong bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Review course
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
