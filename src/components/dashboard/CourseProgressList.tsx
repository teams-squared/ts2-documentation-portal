"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  GraduationCapIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  CATEGORY_ACCENT_COLORS,
} from "@/components/icons";
import type { Role } from "@/lib/types";

interface CourseItem {
  courseId: string;
  courseTitle: string;
  category: string | null;
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  continueUrl: string;
  isComplete?: boolean;
  /** Lesson the learner resumes from. Omitted for completed courses. */
  nextLessonTitle?: string;
}

interface CourseProgressListProps {
  courses: CourseItem[];
  completedCount: number;
  hasEnrollments: boolean;
  userRole: Role;
}

function resolveCategoryKey(category: string | null): string {
  if (!category) return "book";
  const key = category.toLowerCase();
  return key in CATEGORY_ICONS ? key : "book";
}

/** Horizontally scrollable course card row with side buttons and edge fade. */
function ScrollableRow({ courses }: { courses: CourseItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      // Container has horizontal padding; treat values near zero as "at start".
      setCanScrollLeft(el.scrollLeft > 24);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 24);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [courses.length]);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(240, el.clientWidth * 0.8);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  const edgeFade = {
    maskImage:
      "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
    WebkitMaskImage:
      "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={edgeFade}
      >
        {courses.map((course, i) => {
          const categoryKey = resolveCategoryKey(course.category);
          const CategoryIcon = CATEGORY_ICONS[categoryKey] ?? CATEGORY_ICONS.book;
          const iconBgColor = CATEGORY_COLORS[categoryKey];
          const accentColor = CATEGORY_ACCENT_COLORS[categoryKey];
          const isAlmostDone = !course.isComplete && course.percentComplete >= 75 && course.percentComplete < 100;

          return (
            <Link
              key={course.courseId}
              href={course.continueUrl}
              className="group relative flex h-56 w-56 flex-col flex-shrink-0 overflow-hidden rounded-lg border border-border bg-card p-4 pt-5 shadow-sm transition-all hover:border-border-strong hover:shadow-md animate-slide-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Top accent strip in category color */}
              <div
                aria-hidden
                className="absolute top-0 inset-x-0 h-1"
                style={{ background: accentColor }}
              />

              <div className="flex items-start justify-between gap-2 mb-3">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: iconBgColor }}
                >
                  <CategoryIcon
                    className="w-5 h-5"
                    style={{ color: "var(--icon-fg)" }}
                  />
                </div>
                {course.isComplete ? (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-success/60 bg-success-subtle px-2 py-0.5 text-[10px] font-semibold text-success"
                    title="Course completed"
                  >
                    <CheckCircleIcon className="w-4 h-4 text-success" aria-hidden="true" />
                    Completed
                  </span>
                ) : isAlmostDone ? (
                  <span
                    className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-warning-subtle px-2 py-0.5 text-[10px] font-semibold text-warning animate-glow"
                    title="You're almost done!"
                  >
                    Almost
                  </span>
                ) : null}
              </div>

              <h3 className="line-clamp-3 flex-1 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                {course.courseTitle}
              </h3>

              <div className="mt-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <div
                    className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-border"
                    role="progressbar"
                    aria-label={`${course.courseTitle} progress`}
                    aria-valuenow={course.percentComplete}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-[400ms] ease-out"
                      style={{ width: `${course.percentComplete}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">
                    {course.percentComplete}%
                  </span>
                </div>
                <p className="text-xs tabular-nums text-foreground-muted">
                  {course.completedLessons} of {course.totalLessons} lesson
                  {course.totalLessons !== 1 ? "s" : ""}
                </p>
                {!course.isComplete && course.nextLessonTitle ? (
                  <p className="mt-1 truncate text-xs text-foreground-subtle">
                    <span className="text-foreground-muted">Continue:</span>{" "}
                    {course.nextLessonTitle}
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Left scroll button */}
      <button
        type="button"
        onClick={() => scrollBy("left")}
        aria-label="Scroll to previous courses"
        disabled={!canScrollLeft}
        className={`absolute left-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          canScrollLeft ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronLeftIcon className="mx-auto h-4 w-4" />
      </button>

      {/* Right scroll button */}
      <button
        type="button"
        onClick={() => scrollBy("right")}
        aria-label="Scroll to more courses"
        disabled={!canScrollRight}
        className={`absolute right-0 top-1/2 z-10 h-10 w-10 -translate-y-1/2 rounded-full border border-border bg-card text-foreground shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          canScrollRight ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronRightIcon className="mx-auto h-4 w-4" />
      </button>
    </div>
  );
}

export function CourseProgressList({
  courses,
  completedCount,
  hasEnrollments,
  userRole,
}: CourseProgressListProps) {
  // Empty state: no enrollments at all
  if (courses.length === 0 && !hasEnrollments) {
    return (
      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-foreground-muted">
          Your courses
        </h2>
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <GraduationCapIcon className="mx-auto mb-3 h-8 w-8 text-foreground-subtle" />
          <p className="mb-1 text-sm font-medium text-foreground">
            No courses yet
          </p>
          <p className="mb-4 text-xs text-foreground-muted">
            {userRole === "admin"
              ? "Browse the catalog to enroll yourself, or assign courses to your team from the admin panel."
              : "Courses assigned to you will show up here. Reach out to your administrator to get started."}
          </p>
          {userRole === "admin" && (
            <Button asChild size="default">
              <Link href="/courses">Browse the catalog</Link>
            </Button>
          )}
        </div>
      </section>
    );
  }

  const completedBadge =
    completedCount > 0 ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
        <GraduationCapIcon className="h-3.5 w-3.5 text-primary" />
        {completedCount} completed
      </span>
    ) : null;

  // No in-progress courses but completed some (or has enrollments that are all done)
  if (courses.length === 0) {
    return (
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
            Your courses
          </h2>
          {completedBadge}
        </div>
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-foreground-muted">
            You&apos;re all caught up. Great work!
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in animate-init" style={{ animationDelay: "200ms" }}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
          Your courses
        </h2>
        {completedBadge}
      </div>
      <ScrollableRow courses={courses} />
    </section>
  );
}
