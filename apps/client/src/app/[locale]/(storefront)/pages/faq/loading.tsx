const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function FaqLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-12 space-y-6" aria-busy="true">
      <div className="text-center space-y-3 mb-8">
        <div className={`h-10 w-32 mx-auto ${S}`} />
        <div className={`h-4 w-64 mx-auto ${S}`} />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border border-border rounded-card overflow-hidden">
          <div className={`h-14 w-full ${S}`} />
        </div>
      ))}
    </div>
  );
}
