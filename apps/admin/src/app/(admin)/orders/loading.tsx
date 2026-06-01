import { AdminTableRowSkeleton } from '../../../components/skeletons/AdminTableRowSkeleton';

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer ${className ?? ''}`} />
  );
}

export default function OrdersLoading() {
  return (
    <>
      {/* Page header skeleton */}
      <div className="mb-6 space-y-2">
        <Shimmer className="h-7 w-24" />
        <Shimmer className="h-4 w-36" />
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-surface border border-border rounded-card p-4 mb-4 flex items-center gap-3">
        <Shimmer className="h-8 w-36" />
        <Shimmer className="h-8 w-36" />
        <Shimmer className="h-8 w-64" />
        <div className="flex-1" />
        <Shimmer className="h-8 w-28" />
      </div>

      {/* Table skeleton */}
      <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background">
                {['w-8', 'w-28', 'w-40', 'w-16', 'w-24', 'w-28', 'w-20', 'w-16'].map((w, i) => (
                  <th key={i} className="px-4 py-3">
                    <Shimmer className={`h-3 ${w}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => (
                <AdminTableRowSkeleton key={i} cols={8} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
