import { Skeleton, ProductCardSkeleton } from '@ezihubb/ui';

export default function HomeLoading() {
  return (
    <div className="bg-background">
      {/* Hero skeleton */}
      <div className="min-h-[600px] bg-gradient-to-br from-[#FFF5F0] to-[#FEF3E8] flex items-center">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 w-full py-14 md:py-24">
          <div className="flex flex-col-reverse md:flex-row items-center gap-10 md:gap-16">
            <div className="flex-1 max-w-xl w-full space-y-4">
              <Skeleton variant="rect" className="h-12 md:h-14 w-full max-w-lg rounded-lg" />
              <Skeleton variant="rect" className="h-12 md:h-14 w-3/4 max-w-lg rounded-lg" />
              <Skeleton variant="text" className="w-full max-w-md" />
              <Skeleton variant="text" className="w-4/5 max-w-md" />
              <div className="flex gap-3 pt-2">
                <Skeleton variant="rect" className="h-12 w-44 rounded-button" />
                <Skeleton variant="rect" className="h-12 w-44 rounded-button" />
              </div>
            </div>
            <div className="flex-1 w-full max-w-[480px]">
              <div className="grid grid-cols-2 grid-rows-2 gap-3 h-[380px] md:h-[480px]">
                <Skeleton variant="rect" className="row-span-2 rounded-2xl" />
                <Skeleton variant="rect" className="rounded-2xl" />
                <Skeleton variant="rect" className="rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Collections skeleton */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-16">
        <div className="text-center mb-10 space-y-3">
          <Skeleton variant="rect" className="h-9 w-56 mx-auto rounded-lg" />
          <Skeleton variant="text" className="w-80 mx-auto" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="aspect-[4/3] rounded-card" />
          ))}
        </div>
      </div>

      {/* How It Works skeleton */}
      <div className="bg-surface py-16">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="text-center mb-14 space-y-3">
            <Skeleton variant="rect" className="h-9 w-48 mx-auto rounded-lg" />
            <Skeleton variant="text" className="w-72 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-4">
                <Skeleton variant="circle" width={80} height={80} />
                <Skeleton variant="rect" className="h-5 w-28 rounded" />
                <Skeleton variant="text" lines={2} className="w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Products skeleton */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-16">
        <div className="flex justify-between mb-10">
          <div className="space-y-2">
            <Skeleton variant="rect" className="h-9 w-40 rounded-lg" />
            <Skeleton variant="text" className="w-56" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Category tiles skeleton */}
      <div className="bg-surface py-16">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="text-center mb-10 space-y-3">
            <Skeleton variant="rect" className="h-9 w-52 mx-auto rounded-lg" />
            <Skeleton variant="text" className="w-72 mx-auto" />
          </div>
          <div className="flex gap-5 overflow-hidden md:grid md:grid-cols-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2.5 shrink-0">
                <Skeleton variant="circle" width={72} height={72} />
                <Skeleton variant="rect" className="h-4 w-16 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Social proof skeleton */}
      <div className="bg-primary/5 border-y border-border py-12">
        <div className="max-w-[1440px] mx-auto px-4 md:px-8">
          <div className="grid grid-cols-3 divide-x divide-border text-center">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-2 flex flex-col items-center gap-2">
                <Skeleton variant="rect" className="h-9 w-20 rounded-lg" />
                <Skeleton variant="text" className="w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reviews skeleton */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-16">
        <div className="text-center mb-12 space-y-3">
          <Skeleton variant="rect" className="h-9 w-60 mx-auto rounded-lg" />
          <Skeleton variant="text" className="w-80 mx-auto" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-border rounded-card p-6 space-y-4">
              <Skeleton variant="rect" className="h-4 w-24 rounded" />
              <Skeleton variant="text" lines={4} />
              <div className="flex items-center gap-3 pt-2">
                <Skeleton variant="circle" width={36} height={36} />
                <div className="space-y-1 flex-1">
                  <Skeleton variant="text" className="w-28" />
                  <Skeleton variant="text" className="w-20 h-3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
