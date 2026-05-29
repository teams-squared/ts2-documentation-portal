"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon, ChevronRightIcon, CheckCircleIcon, DocumentTextIcon, VideoIcon, QuizIcon, PaperclipIcon, LayoutGridIcon, ClockIcon, ShieldIcon, LinkIcon } from "@/components/icons";
import type { LessonType } from "@/lib/types";
import type { DeadlineInfo } from "@/lib/deadlines";
import { formatDeadlineRelative } from "@/lib/deadlines";

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  order: number;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

const LESSON_TYPE_ICON: Record<LessonType, React.FC<{ className?: string }>> = {
  text: DocumentTextIcon,
  video: VideoIcon,
  quiz: QuizIcon,
  document: PaperclipIcon,
  html: LayoutGridIcon,
  policy_doc: ShieldIcon,
  link: LinkIcon,
};

export function ModuleList({
  modules,
  courseId,
  completedLessonIds,
  deadlineInfoMap,
}: {
  modules: Module[];
  courseId: string;
  completedLessonIds?: Set<string>;
  deadlineInfoMap?: Record<string, DeadlineInfo>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(modules.map((m) => m.id))
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (modules.length === 0) {
    return (
      <p className="text-xs text-foreground-muted py-4 text-center">
        No modules yet.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {modules.map((mod) => (
        <div key={mod.id}>
          <button
            onClick={() => toggle(mod.id)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          >
            {expanded.has(mod.id) ? (
              <ChevronDownIcon className="w-4 h-4 text-foreground-subtle flex-shrink-0" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-foreground-subtle flex-shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground">
              {mod.title}
            </span>
            <span className="ml-auto text-xs text-foreground-subtle">
              {completedLessonIds
                ? `${mod.lessons.filter((l) => completedLessonIds.has(l.id)).length} of ${mod.lessons.length} lesson${mod.lessons.length !== 1 ? "s" : ""}`
                : `${mod.lessons.length} lesson${mod.lessons.length !== 1 ? "s" : ""}`}
            </span>
          </button>

          {expanded.has(mod.id) && mod.lessons.length > 0 && (
            <div className="pl-6 sm:pl-10 pr-4 pb-2 space-y-0.5">
              {mod.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  href={`/courses/${courseId}/lessons/${lesson.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {(() => { const LessonIcon = LESSON_TYPE_ICON[lesson.type]; return <LessonIcon className="w-4 h-4 text-foreground-subtle flex-shrink-0" />; })()}
                  <span className="flex-1">{lesson.title}</span>
                  {(() => {
                    const info = deadlineInfoMap?.[lesson.id];
                    if (!info || info.status === "none" || info.status === "completed") return null;
                    const deadline = new Date(info.absoluteDeadline!);
                    if (info.status === "overdue") return (
                      <span className="flex items-center gap-1 text-xs text-danger flex-shrink-0">
                        <ClockIcon className="w-3 h-3" />Overdue
                      </span>
                    );
                    if (info.status === "due-soon") return (
                      <span className="flex items-center gap-1 text-xs text-warning flex-shrink-0">
                        <ClockIcon className="w-3 h-3" />Due soon
                      </span>
                    );
                    return (
                      <span className="flex items-center gap-1 text-xs text-foreground-subtle flex-shrink-0">
                        <ClockIcon className="w-3 h-3" />{formatDeadlineRelative(deadline)}
                      </span>
                    );
                  })()}
                  {completedLessonIds?.has(lesson.id) && (
                    <CheckCircleIcon className="w-4 h-4 flex-shrink-0 text-success" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
