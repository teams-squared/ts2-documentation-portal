import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  )
}

/* ── App-level skeleton helpers (pre-existing) ─────────────────────────── */

function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  )
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-5",
        className,
      )}
      aria-hidden="true"
    >
      <Skeleton className="h-5 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

function SkeletonCourseCard() {
  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden"
      aria-hidden="true"
    >
      <Skeleton className="aspect-video rounded-none" />
      <div className="p-5">
        <Skeleton className="h-4 w-16 mb-3 rounded-full" />
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}

function SkeletonTableRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <Skeleton className={cn("h-4", i === 0 ? "w-32" : "w-20")} />
        </td>
      ))}
    </tr>
  )
}

function SkeletonGridItem() {
  return (
    <div
      className="rounded-lg border border-border bg-card p-5"
      aria-hidden="true"
    >
      <Skeleton className="aspect-square mb-3 rounded-lg" />
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 py-3 px-1" aria-hidden="true">
      <Skeleton className="h-9 w-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

function SkeletonFormField() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  )
}

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonCourseCard,
  SkeletonTableRow,
  SkeletonGridItem,
  SkeletonListItem,
  SkeletonFormField,
}
