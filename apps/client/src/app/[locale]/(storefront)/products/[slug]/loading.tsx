import { Skeleton, ProductCardSkeleton } from '@ezihubb/ui';

export default function ProductDetailLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* 2-col layout skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-[55fr_45fr] gap-8 lg:gap-14">

        {/* Left: gallery */}
        <div className="flex flex-col gap-3">
          <Skeleton variant="rect" className="w-full aspect-square rounded-card" />
          <div className="hidden md:flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="w-16 h-16 rounded-sm" />
            ))}
          </div>
        </div>

        {/* Right: product info */}
        <div className="space-y-5">
          <div className="space-y-3">
            <Skeleton variant="rect" className="h-4 w-24 rounded" />
            <Skeleton variant="rect" className="h-9 w-full rounded-lg" />
            <Skeleton variant="rect" className="h-6 w-48 rounded" />
            <Skeleton variant="rect" className="h-5 w-16 rounded" />
            <Skeleton variant="rect" className="h-9 w-32 rounded" />
            <Skeleton variant="text" lines={3} />
          </div>

          {/* Variant picker skeleton */}
          <div className="space-y-3">
            <Skeleton variant="rect" className="h-4 w-16 rounded" />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rect" className="h-9 w-16 rounded-button" />
              ))}
            </div>
          </div>

          {/* Customizer skeleton */}
          <div className="hidden md:block border-2 border-border rounded-card p-5 space-y-4">
            <Skeleton variant="rect" className="h-5 w-48 rounded" />
            <Skeleton variant="rect" className="w-full aspect-square rounded-md" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton variant="rect" className="h-4 w-28 rounded" />
                  <Skeleton variant="rect" className="h-10 w-full rounded-sm" />
                </div>
              ))}
            </div>
            <Skeleton variant="rect" className="h-12 w-full rounded-button" />
          </div>
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="mt-14">
        <div className="flex gap-6 border-b border-border mb-6">
          {['Description', 'Shipping', 'Reviews'].map((tab) => (
            <Skeleton key={tab} variant="rect" className="h-9 w-24 rounded" />
          ))}
        </div>
        <Skeleton variant="text" lines={6} />
      </div>

      {/* Related products skeleton */}
      <div className="mt-14">
        <Skeleton variant="rect" className="h-8 w-48 rounded-lg mb-6" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
