import * as React from "react"
import Link from "next/link"
import { Clock, BookOpen } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/Badge"
import { ProgressBar } from "@/components/app/ProgressBar"
import { CourseThumbnail } from "@/components/courses/CourseThumbnail"

/**
 * CourseCard — design-system Section 8.2.
 *
 * Anatomy (top → bottom):
 *   - 16:9 thumbnail (object-contain + padding inside tinted frame; see CourseThumbnail)
 *   - Category badge
 *   - Title (font-display, 2-line clamp)
 *   - Short description (optional, 2-line clamp)
 *   - Meta row (modules · duration)
 *   - Progress bar (only when enrolled and `progress` is supplied)
 *
 * Accessibility: the entire card is a single anchor — no nested tap targets.
 */

interface CourseCardProps {
  href: string
  title: string
  description?: string | null
  category?: string | null
  thumbnail?: string | null
  /** 0..100. Omit to hide the progress track. */
  progress?: number
  /** Lesson/module counts for the meta row. */
  moduleCount?: number
  durationLabel?: string // e.g. "2h 30m"
  className?: string
}

export function CourseCard({
  href,
  title,
  description,
  category,
  thumbnail,
  progress,
  moduleCount,
  durationLabel,
  className,
}: CourseCardProps) {
  const hasProgress = typeof progress === "number"

  return (
    <Link
      href={href}
      className={cn(
        "group block overflow-hidden rounded-lg border border-border bg-card shadow-sm outline-none",
        "transition-[transform,box-shadow,border-color] duration-150 ease-out motion-safe:hover:-translate-y-0.5",
        "hover:border-border-strong hover:shadow-md",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <CourseThumbnail title={title} src={thumbnail} />

      <div className="flex flex-col gap-2 p-4">
        {category && (
          <Badge variant="secondary" className="w-fit">
            {category}
          </Badge>
        )}

        <h3 className="font-display text-lg font-semibold leading-snug text-foreground line-clamp-2">
          {title}
        </h3>

        {description && (
          <p className="text-sm text-foreground-muted line-clamp-2">
            {description}
          </p>
        )}

        {(moduleCount != null || durationLabel) && (
          <div className="flex items-center gap-3 text-sm text-foreground-muted">
            {moduleCount != null && (
              <span className="inline-flex items-center gap-1">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                {moduleCount} {moduleCount === 1 ? "module" : "modules"}
              </span>
            )}
            {durationLabel && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden="true" />
                {durationLabel}
              </span>
            )}
          </div>
        )}

        {hasProgress && (
          <div className="mt-2">
            <ProgressBar
              value={progress}
              label={`${title} progress`}
              showPercent
            />
          </div>
        )}
      </div>
    </Link>
  )
}
