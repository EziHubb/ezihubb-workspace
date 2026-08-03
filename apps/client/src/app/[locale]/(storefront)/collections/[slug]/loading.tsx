import { Skeleton, ProductCardSkeleton } from '@ezihubb/ui';

export default function CollectionLoading() {
  return (
    <>
      {/* Hero banner skeleton */}
      <Skeleton variant="rect" className="w-full h-52 md:h-72 lg:h-80 rounded-none" />

      {/* Listing area */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <Skeleton variant="rect" className="h-10 w-72 rounded-lg" />
          <Skeleton variant="text" className="w-96 max-w-full" />
        </div>

        <div className="flex gap-8 items-start">
          {/* Sidebar skeleton */}
          <div className="hidden md:flex flex-col gap-6 w-[260px] shrink-0">
            <div className="space-y-3">
              <Skeleton variant="rect" className="h-5 w-24 rounded" />
              <Skeleton variant="rect" className="h-2 w-full rounded-full" />
              <Skeleton variant="rect" className="h-2 w-full rounded-full" />
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

          {/* Product grid skeleton */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <Skeleton variant="rect" className="h-5 w-28 rounded" />
              <Skeleton variant="rect" className="h-9 w-36 rounded-button" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Related collections skeleton */}
      <div className="bg-surface border-t border-border py-12 mt-4">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <Skeleton variant="rect" className="h-8 w-48 rounded-lg mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="aspect-[4/3] rounded-card" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
