const S = 'animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm';
export default function ForgotPasswordLoading() {
  return (
    <div className="w-full max-w-[420px] space-y-5">
      <div className={`h-8 w-52 ${S}`} />
      <div className={`h-4 w-full ${S}`} />
      <div className={`h-12 w-full ${S}`} />
      <div className={`h-12 w-full rounded-button ${S}`} />
    </div>
  );
}
