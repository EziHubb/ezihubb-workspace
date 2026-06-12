export type DropState = 'pre-launch' | 'live' | 'sold-out';

interface DropBadgeProps {
  state:          DropState;
  soldCount?:     number;
  quantityLimit?: number;
}

export function DropBadge({ state, soldCount, quantityLimit }: DropBadgeProps) {
  if (state === 'live') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm"
        style={{ background: '#E85D3F' }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
        🔥 DROP LIVE
        {quantityLimit != null && soldCount != null && quantityLimit - soldCount > 0 && (
          <span className="opacity-90">· {quantityLimit - soldCount} left</span>
        )}
      </span>
    );
  }

  if (state === 'pre-launch') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white"
        style={{ background: '#F59E0B' }}
      >
        DROP
      </span>
    );
  }

  // sold-out
  return (
    <span className="inline-flex items-center rounded-full bg-gray-400 px-2.5 py-1 text-xs font-bold text-white">
      SOLD OUT
    </span>
  );
}

// ── Stock urgency bar (shown on live drops with limited qty) ─────────────────

interface StockUrgencyBarProps {
  remaining: number;
  soldCount: number;
  total:     number;
}

export function StockUrgencyBar({ remaining, soldCount, total }: StockUrgencyBarProps) {
  if (remaining > 100 || total === 0) return null;
  const pct = Math.max(0, Math.min(100, ((total - remaining) / total) * 100));

  return (
    <div className="space-y-1">
      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: '#E85D3F' }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium" style={{ color: '#E85D3F' }}>Only {remaining} remaining</span>
        <span className="text-gray-400">{soldCount} sold</span>
      </div>
    </div>
  );
}
