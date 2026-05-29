import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

interface Lesson {
  id: string;
  title: string;
}

interface Module {
  lessons: Lesson[];
}

interface LessonNavigationProps {
  courseId: string;
  currentLessonId: string;
  modules: Module[];
}

/**
 * Renders previous / next lesson navigation cards at the bottom of lesson content.
 * Returns null when the lesson is both first and last (single-lesson course).
 */
export function LessonNavigation({
  courseId,
  currentLessonId,
  modules,
}: LessonNavigationProps) {
  const allLessons = modules.flatMap((m) => m.lessons);
  const currentIndex = allLessons.findIndex((l) => l.id === currentLessonId);

  if (currentIndex === -1) return null;

  const prev = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
  const next = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  if (!prev && !next) return null;

  return (
    <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-stretch">
      {prev ? (
        <Link
          href={`/courses/${courseId}/lessons/${prev.id}`}
          className="group flex w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-all hover:border-border-strong hover:shadow-sm sm:flex-1"
        >
          <ChevronLeftIcon className="h-4 w-4 flex-shrink-0 text-foreground-subtle transition-colors group-hover:text-primary" />
          <div className="min-w-0">
            <p className="mb-0.5 text-xs text-foreground-subtle">Previous</p>
            <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
              {prev.title}
            </p>
          </div>
        </Link>
      ) : (
        <div className="flex-1" />
      )}

      {next ? (
        <Link
          href={`/courses/${courseId}/lessons/${next.id}`}
          className="group flex w-full min-w-0 items-center justify-end gap-3 rounded-lg border border-border bg-card px-4 py-3 text-right transition-all hover:border-border-strong hover:shadow-sm sm:flex-1"
        >
          <div className="min-w-0">
            <p className="mb-0.5 text-xs text-foreground-subtle">Next</p>
            <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
              {next.title}
            </p>
          </div>
          <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-foreground-subtle transition-colors group-hover:text-primary" />
        </Link>
      ) : (
        <div className="flex-1" />
      )}
    </div>
  );
}
