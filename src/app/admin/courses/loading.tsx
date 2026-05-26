import { Skeleton, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function AdminCoursesLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-muted">
              {["Title", "Status", "Created", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3 text-left">
                  <Skeleton className="h-4 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonTableRow key={i} cols={4} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
