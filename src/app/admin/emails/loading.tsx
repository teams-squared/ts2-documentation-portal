import { Skeleton, SkeletonFormField } from "@/components/ui/Skeleton";

export default function AdminEmailsLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-32 mb-6" />
      <div className="flex gap-1 mb-6 border-b border-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-28 my-3 mx-2" />
        ))}
      </div>
      <div className="max-w-2xl space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonFormField key={i} />
        ))}
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}
