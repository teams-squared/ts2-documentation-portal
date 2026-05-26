import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function AdminIsoLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-28 mb-6" />
      <div className="flex gap-1 mb-6 border-b border-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24 my-3 mx-2" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
