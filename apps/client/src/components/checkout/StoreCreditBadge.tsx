'use client';

import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { useAuthStore } from '../../lib/store/auth.store';

interface StoreCreditsMeResponse {
  credits: unknown[];
  total:   number;
}

interface StoreCreditBadgeProps {
  onApply?: (amount: number) => void;
}

export function StoreCreditBadge({ onApply }: StoreCreditBadgeProps) {
  const token = useAuthStore((s) => s.accessToken);

  const [balance, setBalance] = useState<number | null>(null);
  const [applied, setApplied] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiClient
      .get<StoreCreditsMeResponse>(API_ROUTES.STORE_CREDITS.STORE_CREDITS_ME, {
        token: token ?? undefined,
      })
      .then((d) => {
        setBalance(d.total);
        if (d.total > 0) onApply?.(d.total);
      })
      .catch(() => {});
  }, [token]);

  const handleRemove = () => {
    setApplied(false);
    onApply?.(0);
  };

  const handleReApply = () => {
    setApplied(true);
    onApply?.(balance ?? 0);
  };

  // ── No credit: show promo nudge ───────────────────────────────────────────

  if (!balance || balance <= 0) {
    return (
      <div className="flex items-center justify-between rounded-xl px-3.5 py-3" style={{ background: '#FAFAF8' }}>
        <span className="text-xs text-gray-500">
          💡 Share your last order to earn $4 store credit
        </span>
        <a href="/account/referrals" className="text-xs font-semibold ml-2 shrink-0" style={{ color: '#E85D3F' }}>
          Share →
        </a>
      </div>
    );
  }

  // ── Has credit: applied banner ────────────────────────────────────────────

  if (applied) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl px-3.5 py-3 border"
        style={{ background: '#F0FDF4', borderColor: '#86EFAC' }}
      >
        <Check className="w-4 h-4 shrink-0" style={{ color: '#2E7D52' }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold" style={{ color: '#2E7D52' }}>
            You have ${balance.toFixed(2)} store credit
          </span>
          <span className="text-xs text-gray-500 ml-1.5">Applied automatically to this order</span>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="shrink-0 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 transition-colors"
        >
          <X className="w-3 h-3" />
          Remove
        </button>
      </div>
    );
  }

  // ── Removed state ─────────────────────────────────────────────────────────

  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3.5 py-3 bg-white">
      <span className="text-sm text-gray-500">
        ${balance.toFixed(2)} store credit available
      </span>
      <button
        type="button"
        onClick={handleReApply}
        className="text-xs font-semibold" style={{ color: '#E85D3F' }}
      >
        Apply
      </button>
    </div>
  );
}
