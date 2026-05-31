const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';

export function ReviewCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading review"
      className="border border-border rounded-card p-5 space-y-4"
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full shrink-0 ${S}`} />
        <div className="space-y-1.5 flex-1">
          <div className={`h-4 w-28 ${S}`} />
          <div className={`h-3 w-20 ${S}`} />
        </div>
      </div>

      {/* Stars */}
      <div className={`h-4 w-24 ${S}`} />

      {/* Body text */}
      <div className="space-y-2">
        <div className={`h-3.5 w-full ${S}`} />
        <div className={`h-3.5 w-full ${S}`} />
        <div className={`h-3.5 w-3/4 ${S}`} />
      </div>
    </div>
  );
}
