import { Skeleton } from '@mlh/ui';

export default function TrackOrderLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 md:py-20">
      {/* Hero skeleton */}
      <div className="text-center space-y-3 mb-10">
        <Skeleton variant="text" className="h-9 w-64 mx-auto" />
        <Skeleton variant="text" className="h-4 w-80 mx-auto" />
      </div>

      {/* Card skeleton */}
      <div className="max-w-[560px] mx-auto bg-surface border border-border rounded-card p-6 space-y-5">
        <div className="space-y-1.5">
          <Skeleton variant="text" className="h-3.5 w-28" />
          <Skeleton variant="rect" className="h-10 w-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton variant="text" className="h-3.5 w-24" />
          <Skeleton variant="rect" className="h-10 w-full" />
        </div>
        <Skeleton variant="rect" className="h-11 w-full rounded-button" />
      </div>
    </div>
  );
}
