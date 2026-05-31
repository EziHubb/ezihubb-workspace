const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function GiftCardsLoading() {
  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-12" aria-busy="true">
      <div className="text-center space-y-3 mb-12">
        <div className={`h-10 w-64 mx-auto ${S}`} />
        <div className={`h-4 w-80 mx-auto ${S}`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
        {[25,50,75,100].map(v => (
          <div key={v} className={`aspect-[7/4] rounded-xl ${S}`} />
        ))}
      </div>
      <div className="max-w-md mx-auto mt-10 space-y-4">
        <div className={`h-4 w-36 ${S}`} />
        <div className={`h-12 w-full ${S}`} />
        <div className={`h-12 w-full rounded-button ${S}`} />
      </div>
    </div>
  );
}
