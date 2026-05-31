// Shared shimmer base — matches Tailwind animate-shimmer defined in libs/ui/tailwind.config.js
const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';

export function ProductCardSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading product"
      className="bg-surface border border-border rounded-card p-4 space-y-3"
    >
      {/* Square image area */}
      <div className={`aspect-square w-full rounded-lg ${S}`} />

      {/* Product name — 2 lines */}
      <div className="space-y-1.5">
        <div className={`h-4 w-full ${S}`} />
        <div className={`h-4 w-3/4 ${S}`} />
      </div>

      {/* Price */}
      <div className={`h-5 w-24 ${S}`} />

      {/* Rating */}
      <div className="flex items-center gap-1.5">
        <div className={`h-3.5 w-20 ${S}`} />
        <div className={`h-3.5 w-10 ${S}`} />
      </div>
    </div>
  );
}
