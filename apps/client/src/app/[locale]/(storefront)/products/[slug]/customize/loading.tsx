const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function CustomizeLoading() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#1A1A1A]" aria-busy="true">
      <div className="flex items-center justify-center" style={{ height: '46vh' }}>
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
      <div className="flex-1 bg-white rounded-t-[20px] px-5 pt-8">
        <div className="space-y-3">
          <div className={`h-1 w-full rounded-full ${S}`} />
          <div className={`h-4 w-32 ${S}`} />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className={`h-3.5 w-28 ${S}`} />
              <div className={`h-11 w-full ${S}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
