import { Skeleton, SkeletonTableRow } from "@/components/ui/Skeleton";

export default function AdminProgressLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-32 mb-6" />
      <div className="flex gap-3 mb-4">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-muted">
              {["Course", "Enrolled", "Avg progress", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3 text-left">
                  <Skeleton className="h-4 w-20" />
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
