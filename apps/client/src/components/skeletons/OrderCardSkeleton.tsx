const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';

export function OrderCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading order"
      className="border border-border rounded-card p-4 space-y-4"
    >
      {/* Thumbnail row */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`w-16 h-16 shrink-0 ${S}`} style={{ borderRadius: 4 }} />
        ))}
      </div>

      {/* Order number + date */}
      <div className="space-y-2">
        <div className={`h-4 w-40 ${S}`} />
        <div className={`h-3.5 w-28 ${S}`} />
      </div>

      {/* Status badge + price */}
      <div className="flex items-center gap-3">
        <div className={`h-5 w-24 rounded-pill ${S}`} />
        <div className={`h-5 w-16 ${S}`} />
      </div>

      {/* Buttons */}
      <div className="flex gap-2 pt-1 border-t border-border">
        <div className={`h-9 w-28 rounded-button ${S}`} />
        <div className={`h-9 w-28 rounded-button ${S}`} />
      </div>
    </div>
  );
}
