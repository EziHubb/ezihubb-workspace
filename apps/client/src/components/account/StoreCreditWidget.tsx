'use client';

import { CreditCard } from 'lucide-react';
import { API_ROUTES } from '@mlh/constants';
import { useAuthQuery } from '../../lib/hooks/useAuthQuery';
import { fmtAmount } from '../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreCredit {
  id:        string;
  amount:    number;
  reason:    string;
  expiresAt: string | null;
  usedAt:    string | null;
  createdAt: string;
}

interface StoreCreditsMeResponse {
  credits: StoreCredit[];
  total:   number;
}

// ── Source label helper ───────────────────────────────────────────────────────

function sourceLabel(reason: string): string {
  switch (reason) {
    case 'BUYER_REFERRAL': return 'Referral reward';
    case 'ADMIN_GRANT':    return 'Admin grant';
    case 'RETURN_CREDIT':  return 'Return credit';
    default:               return reason.replace(/_/g, ' ').toLowerCase();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StoreCreditWidget() {
  const { data, isLoading } = useAuthQuery<StoreCreditsMeResponse>(
    ['account', 'store-credits'],
    API_ROUTES.STORE_CREDITS.STORE_CREDITS_ME,
  );

  // Show nothing while loading or when there is truly nothing to display
  if (isLoading || !data) return null;

  return (
    <div className="bg-surface border border-border rounded-card p-4 shadow-sm space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted">
          <CreditCard className="w-4 h-4" />
          <h3 className="text-xs font-semibold uppercase tracking-wide">Store Credit</h3>
        </div>
        <span className="text-2xl font-bold text-green-700 tabular-nums">
          {fmtAmount(data.total)}
        </span>
      </div>

      {/* Credits list */}
      {data.credits.length > 0 ? (
        <ul className="divide-y divide-border text-sm">
          {data.credits.slice(0, 5).map((credit) => (
            <li key={credit.id} className="flex justify-between py-1.5 gap-3">
              <div className="space-y-0.5 min-w-0">
                <p className="text-secondary font-medium truncate capitalize">
                  {sourceLabel(credit.reason)}
                </p>
                {credit.expiresAt && !credit.usedAt && (
                  <p className="text-xs text-muted">
                    Expires{' '}
                    {new Date(credit.expiresAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day:   'numeric',
                      year:  'numeric',
                    })}
                  </p>
                )}
              </div>
              <span
                className={`font-medium tabular-nums shrink-0 ${
                  credit.usedAt ? 'text-muted line-through' : 'text-green-700'
                }`}
              >
                {fmtAmount(Number(credit.amount))}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          No store credits yet. Refer friends to earn credits!
        </p>
      )}
    </div>
  );
}
