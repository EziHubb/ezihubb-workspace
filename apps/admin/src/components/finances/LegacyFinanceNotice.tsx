'use client';
import { usePathname } from 'next/navigation';

/** Monetary analytics only. Operational counts remain separate from money.
 * Client pathname is intentional: the shared App Router layout persists. */
export function LegacyFinanceNotice() {
  const pathname = usePathname();
  if (!/^\/(dashboard|stats|marketing|finance|finances|payments|payouts)(\/|$)/.test(pathname ?? '')) return null;
  return <aside className="mb-4 rounded-card border border-border bg-surface p-4 text-sm text-secondary" aria-label="Historical monetary reporting scope">
    Historical monetary analytics: LEGACY_UNKNOWN. These projections are not verified collected funds, available payout balances or profit.
    Versioned captured funds and TEST/LIVE records are reported separately under verified money totals. Operational order counts do not imply payment.
  </aside>;
}
