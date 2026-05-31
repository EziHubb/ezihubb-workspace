import { OrderCardSkeleton } from '../../../../../components/skeletons/OrderCardSkeleton';

export default function OrdersLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading orders">
      {/* Header */}
      <div className="h-8 w-36 animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%] rounded-sm" />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-20 rounded-sm shrink-0 animate-shimmer bg-gradient-to-r from-border/60 via-background to-border/60 bg-[length:400%_100%]"
          />
        ))}
      </div>

      {/* Order cards */}
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
