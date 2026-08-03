import { Skeleton, ProductCardSkeleton } from '@ezihubb/ui';

export function ListingLoadingSkeleton() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <Skeleton variant="rect" className="h-10 w-72 rounded-lg" />
        <Skeleton variant="text" className="w-80" />
      </div>

      <div className="flex gap-8 items-start">
        {/* Sidebar skeleton — desktop only */}
        <div className="hidden md:flex flex-col gap-6 w-[260px] shrink-0">
          <div className="space-y-3">
            <Skeleton variant="rect" className="h-5 w-20 rounded" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton variant="rect" className="w-4 h-4 rounded" />
                <Skeleton variant="text" className="flex-1" />
                <Skeleton variant="rect" className="w-6 h-3 rounded" />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <Skeleton variant="rect" className="h-5 w-24 rounded" />
            <Skeleton variant="rect" className="h-2 w-full rounded-full" />
            <Skeleton variant="rect" className="h-2 w-full rounded-full" />
            <Skeleton variant="text" className="w-28 mx-auto" />
          </div>

          <div className="space-y-2">
            <Skeleton variant="rect" className="h-5 w-28 rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton variant="circle" width={16} height={16} />
                <Skeleton variant="text" className="w-24" />
              </div>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {/* Sort bar */}
          <div className="flex justify-between items-center mb-6">
            <Skeleton variant="rect" className="h-5 w-28 rounded" />
            <Skeleton variant="rect" className="h-9 w-36 rounded-button" />
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>

          {/* Pagination placeholder */}
          <div className="mt-10 flex justify-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="w-9 h-9 rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
