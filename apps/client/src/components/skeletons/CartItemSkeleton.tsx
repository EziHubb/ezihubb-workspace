const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';

export function CartItemSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading cart item"
      className="flex gap-4 py-4 border-b border-border last:border-0"
    >
      {/* Thumbnail */}
      <div className={`w-20 h-20 shrink-0 rounded-md ${S}`} />

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className={`h-4 w-full max-w-[200px] ${S}`} />
        <div className={`h-3.5 w-24 ${S}`} />
        <div className={`h-4 w-16 ${S}`} />

        {/* Quantity controls */}
        <div className="flex items-center gap-2 pt-1">
          <div className={`h-8 w-24 rounded-button ${S}`} />
          <div className={`h-8 w-16 rounded-button ${S}`} />
        </div>
      </div>

      {/* Price */}
      <div className="shrink-0 space-y-1 text-right">
        <div className={`h-5 w-16 ${S}`} />
        <div className={`h-3.5 w-10 ${S}`} />
      </div>
    </div>
  );
}
