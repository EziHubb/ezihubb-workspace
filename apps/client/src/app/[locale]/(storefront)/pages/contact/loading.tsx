const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function ContactLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12 space-y-8" aria-busy="true">
      <div className="text-center space-y-3">
        <div className={`h-10 w-40 mx-auto ${S}`} />
        <div className={`h-4 w-72 mx-auto ${S}`} />
      </div>
      <div className="space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className={`h-3.5 w-24 ${S}`} />
            <div className={`h-11 w-full ${S}`} />
          </div>
        ))}
        <div className="space-y-1.5">
          <div className={`h-3.5 w-24 ${S}`} />
          <div className={`h-28 w-full ${S}`} />
        </div>
        <div className={`h-12 w-full rounded-button ${S}`} />
      </div>
    </div>
  );
}
