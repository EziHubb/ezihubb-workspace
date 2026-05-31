const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function AboutLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12 space-y-10" aria-busy="true">
      <div className="text-center space-y-3">
        <div className={`h-10 w-56 mx-auto ${S}`} />
        <div className={`h-4 w-96 mx-auto ${S}`} />
      </div>
      <div className={`w-full h-64 rounded-card ${S}`} />
      <div className="space-y-3 max-w-2xl mx-auto">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`h-4 ${i % 5 === 4 ? 'w-3/4' : 'w-full'} ${S}`} />
        ))}
      </div>
    </div>
  );
}
