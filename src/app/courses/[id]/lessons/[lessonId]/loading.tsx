import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

export default function LessonLoading() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
      {/* Module outline sidebar */}
      <aside className="hidden lg:block">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </aside>
      {/* Lesson body */}
      <div className="min-w-0">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-3/4 mb-4" />
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-5">
          <SkeletonText lines={4} />
          <SkeletonText lines={5} />
          <SkeletonText lines={3} />
        </div>
      </div>
    </div>
  );
}
