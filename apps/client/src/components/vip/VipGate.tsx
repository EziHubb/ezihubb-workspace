'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Lock } from 'lucide-react';
import { CountdownTimer } from '../campaign/CountdownTimer';
import { ProgressFill } from '../campaign/ProgressFill';

interface VipGateProps {
  requiredTier:    string;  // e.g. "Gold VIP"
  /** When the deal opens to the public */
  opensAt:         string | Date;
  userCoins?:      number;
  coinsForNextTier?: number;
  tierName?:       string;
}

export function VipGate({
  requiredTier,
  opensAt,
  userCoins        = 0,
  coinsForNextTier = 15_000,
  tierName         = 'Gold VIP',
}: VipGateProps) {
  const locale = useLocale();
  const pct    = Math.min(100, (userCoins / coinsForNextTier) * 100);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-8 px-4">
      {/* Lock icon */}
      <div className="w-16 h-16 rounded-full bg-muted/10 flex items-center justify-center">
        <Lock className="w-8 h-8 text-[#9CA3AF]" />
      </div>

      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold text-secondary">
          This deal isn&apos;t public yet
        </h2>
        <p className="text-muted text-sm">
          {requiredTier} members have early access right now.
        </p>
      </div>

      {/* Large countdown */}
      <div className="space-y-2">
        <p className="text-xs text-muted uppercase tracking-widest">Opens to everyone in:</p>
        <CountdownTimer targetDate={opensAt} size="lg" />
      </div>

      {/* Unlock card */}
      <div className="bg-surface border border-border rounded-2xl shadow-lg p-6 max-w-sm w-full space-y-4 text-left">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⭐</span>
          <div>
            <h4 className="font-semibold text-secondary text-sm">Unlock {tierName}</h4>
            <p className="text-xs text-muted mt-0.5">
              See flash deals 1h before the public
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>{userCoins.toLocaleString()} / {coinsForNextTier.toLocaleString()} coins to {tierName}</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <ProgressFill pct={pct} size="thin" />
        </div>

        <Link
          href={`/${locale}/account/coins`}
          className="block w-full bg-primary hover:bg-primary-dark text-white text-sm font-bold text-center py-3 rounded-full transition-colors uppercase tracking-wide"
        >
          Earn coins faster →
        </Link>
      </div>
    </div>
  );
}
