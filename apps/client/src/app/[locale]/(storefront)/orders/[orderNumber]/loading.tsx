const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function OrderTrackingDetailLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8" aria-busy="true">
      <div className={`h-4 w-48 mb-6 ${S}`} />
      <div className="max-w-2xl space-y-0">
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center">
            <div className="space-y-1.5">
              <div className={`h-5 w-44 ${S}`} />
              <div className={`h-3.5 w-32 ${S}`} />
            </div>
            <div className={`h-6 w-24 rounded-pill ${S}`} />
          </div>
          <div className="px-6 py-5 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className={`w-8 h-8 rounded-full shrink-0 ${S}`} />
                <div className="space-y-1.5 flex-1">
                  <div className={`h-4 w-28 ${S}`} />
                  <div className={`h-3 w-20 ${S}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
