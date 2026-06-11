export type DropState = 'pre-launch' | 'live' | 'sold-out';

interface DropBadgeProps {
  state: DropState;
  soldCount?: number;
  quantityLimit?: number;
}

export function DropBadge({ state, soldCount, quantityLimit }: DropBadgeProps) {
  if (state === 'live') {
    const remaining = quantityLimit != null ? quantityLimit - (soldCount ?? 0) : null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold text-white shadow">
        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
        LIVE DROP{remaining !== null ? ` · ${remaining} left` : ''}
      </span>
    );
  }
  if (state === 'pre-launch') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500 px-2.5 py-0.5 text-xs font-bold text-white">
        🔔 Coming Drop
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-400 px-2.5 py-0.5 text-xs font-bold text-white">
      Sold Out
    </span>
  );
}
