function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] animate-shimmer ${className ?? ''}`}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-surface rounded-card p-5 shadow-card border border-border">
      <div className="flex items-start justify-between mb-4">
        <Shimmer className="w-10 h-10 rounded-lg" />
        <Shimmer className="w-16 h-5 rounded-pill" />
      </div>
      <Shimmer className="h-9 w-28 mb-2" />
      <Shimmer className="h-4 w-20" />
    </div>
  );
}
