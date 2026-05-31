const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function CheckoutSuccessLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-5" aria-busy="true">
      <div className={`w-16 h-16 rounded-full mx-auto ${S}`} />
      <div className={`h-8 w-56 mx-auto ${S}`} />
      <div className={`h-4 w-full ${S}`} />
      <div className={`h-4 w-4/5 mx-auto ${S}`} />
      <div className="flex gap-3 justify-center pt-2">
        <div className={`h-11 w-36 rounded-button ${S}`} />
        <div className={`h-11 w-36 rounded-button ${S}`} />
      </div>
    </div>
  );
}
