'use client';

import { Zap, AlertTriangle, Clock } from 'lucide-react';
import { useCountdown } from '../../hooks/useCountdown';

type BannerState = 'normal' | 'urgent' | 'grace';

interface FlashDealBannerProps {
  endsAt:        string | Date;
  discountPct:   number;
  gracePct?:     number;  // discount % locked during grace
  graceEndsAt?:  string | Date;
}

function Timer({ target }: { target: string | Date }) {
  const { hours, minutes, seconds, expired } = useCountdown(target);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (expired) return <span className="font-mono font-bold text-muted">00:00:00</span>;
  return (
    <span className="font-mono font-bold tabular-nums">
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}

export function FlashDealBanner({
  endsAt,
  discountPct,
  graceEndsAt,
  gracePct,
}: FlashDealBannerProps) {
  const { hours: h, minutes: m, expired } = useCountdown(endsAt);
  const isUrgent = !expired && h === 0 && m < 60;
  const isGrace  = expired && !!graceEndsAt;
  const { expired: graceExpired } = useCountdown(graceEndsAt ?? endsAt);

  if (expired && (!graceEndsAt || graceExpired)) return null;

  let state: BannerState = 'normal';
  if (isGrace)  state = 'grace';
  else if (isUrgent) state = 'urgent';

  if (state === 'grace') {
    return (
      <div className="flex items-center gap-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-xl px-4 py-3">
        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">
            Flash deal ended — your locked price valid{' '}
            <Timer target={graceEndsAt!} /> more
          </p>
          <p className="text-xs text-amber-700 mt-0.5">15-min grace window — price locked at checkout</p>
        </div>
      </div>
    );
  }

  if (state === 'urgent') {
    return (
      <div className="flex items-center gap-3 bg-[#FEF2F2] border border-[#EF4444] rounded-xl px-4 py-3">
        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-700">
            ⚡ Hurry! Only <Timer target={endsAt} /> left
          </p>
          <p className="text-xs text-red-600 mt-0.5">Price reverts when timer hits 0</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
      <Zap className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-secondary">
          Flash Deal ends in: <span className="text-primary"><Timer target={endsAt} /></span>
        </p>
        <p className="text-xs text-muted mt-0.5">{discountPct}% off — limited time only</p>
      </div>
    </div>
  );
}
