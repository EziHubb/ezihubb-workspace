const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function CheckoutLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12" aria-busy="true">
      <div className={`h-8 w-32 mb-8 ${S}`} />
      {/* Step indicators */}
      <div className="flex gap-2 mb-8">
        {[1,2,3].map(i => <div key={i} className={`h-2 flex-1 rounded-full ${S}`} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className={`h-3.5 w-28 ${S}`} />
              <div className={`h-11 w-full ${S}`} />
            </div>
          ))}
        </div>
        <div className="border border-border rounded-card p-5 space-y-4 h-fit">
          <div className={`h-5 w-32 ${S}`} />
          {[1,2,3].map(i => (
            <div key={i} className="flex justify-between">
              <div className={`h-4 w-24 ${S}`} />
              <div className={`h-4 w-16 ${S}`} />
            </div>
          ))}
          <div className={`h-12 w-full rounded-button ${S}`} />
        </div>
      </div>
    </div>
  );
}
