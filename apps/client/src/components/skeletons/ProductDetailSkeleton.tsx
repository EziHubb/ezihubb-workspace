const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';

export function ProductDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading product"
      className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12"
    >
      <div className="grid grid-cols-1 md:grid-cols-[55fr_45fr] gap-8 lg:gap-14">
        {/* Left: gallery */}
        <div className="space-y-3">
          <div className={`w-full aspect-square rounded-card ${S}`} />
          <div className="hidden md:flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`w-16 h-16 shrink-0 ${S}`} style={{ borderRadius: 4 }} />
            ))}
          </div>
        </div>

        {/* Right: product info */}
        <div className="space-y-5">
          {/* Breadcrumb */}
          <div className={`h-3.5 w-32 ${S}`} />

          {/* Title */}
          <div className="space-y-2">
            <div className={`h-8 w-full ${S}`} />
            <div className={`h-8 w-3/4 ${S}`} />
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2">
            <div className={`h-4 w-24 ${S}`} />
            <div className={`h-4 w-16 ${S}`} />
          </div>

          {/* Price */}
          <div className={`h-9 w-32 ${S}`} />

          {/* Description */}
          <div className="space-y-2 pt-1">
            <div className={`h-3.5 w-full ${S}`} />
            <div className={`h-3.5 w-full ${S}`} />
            <div className={`h-3.5 w-2/3 ${S}`} />
          </div>

          {/* Variant picker */}
          <div className="space-y-2 pt-1">
            <div className={`h-4 w-16 ${S}`} />
            <div className="flex gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={`h-9 w-16 rounded-button ${S}`} />
              ))}
            </div>
          </div>

          {/* Customizer form fields */}
          <div className="hidden md:block border-2 border-border rounded-card p-5 space-y-4">
            <div className={`h-5 w-48 ${S}`} />
            <div className={`w-full aspect-square max-h-[240px] rounded-md ${S}`} />
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className={`h-4 w-28 ${S}`} />
                <div className={`h-10 w-full ${S}`} />
              </div>
            ))}
            <div className={`h-12 w-full rounded-button ${S}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
