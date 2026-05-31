import { Skeleton } from '@mlh/ui';

export default function OccasionsLoading() {
  return (
    <div>
      {/* Hero skeleton */}
      <div className="py-14 md:py-20 text-center px-4 bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <Skeleton variant="rect" className="h-3 w-36 rounded mx-auto mb-4" />
        <Skeleton variant="rect" className="h-10 w-64 rounded-lg mx-auto mb-4" />
        <Skeleton variant="rect" className="h-4 w-80 rounded mx-auto" />
        <Skeleton variant="rect" className="h-4 w-72 rounded mx-auto mt-2" />
      </div>

      {/* Grid skeleton */}
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 mt-12 mb-16">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rect"
              className="aspect-[4/3] rounded-xl"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
