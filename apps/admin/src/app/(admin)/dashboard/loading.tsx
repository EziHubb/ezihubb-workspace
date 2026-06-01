import { StatCardSkeleton } from '../../../components/skeletons/StatCardSkeleton';
import { ChartSkeleton } from '../../../components/skeletons/ChartSkeleton';

function TableSkeleton() {
  return (
    <div className="bg-surface rounded-card border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="h-4 w-32 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded" />
      </div>
      {/* Rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded" />
              <div className="h-3 w-24 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded" />
            </div>
            <div className="h-3.5 w-16 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded" />
            <div className="h-3.5 w-12 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <>
      {/* Page header skeleton */}
      <div className="mb-6 space-y-2">
        <div className="h-7 w-32 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded" />
        <div className="h-4 w-48 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer rounded" />
      </div>

      {/* Row 1: KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-5 mb-6">
        <ChartSkeleton height={310} />
        <ChartSkeleton height={310} />
      </div>

      {/* Row 3: Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-[60fr_40fr] gap-5">
        <TableSkeleton />
        <TableSkeleton />
      </div>
    </>
  );
}
