const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';

export function DashboardStatCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading stat"
      className="bg-surface border border-border rounded-card p-5 space-y-3"
    >
      {/* Icon circle + label */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full shrink-0 ${S}`} />
        <div className={`h-4 w-28 ${S}`} />
      </div>

      {/* Big number */}
      <div className={`h-9 w-32 ${S}`} />

      {/* Trend bar */}
      <div className="flex items-center gap-2">
        <div className={`h-3.5 w-12 ${S}`} />
        <div className={`h-3.5 w-20 ${S}`} />
      </div>
    </div>
  );
}
