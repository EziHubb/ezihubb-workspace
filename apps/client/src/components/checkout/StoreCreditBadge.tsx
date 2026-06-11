'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { useAuthStore } from '../../lib/store/auth.store';

interface StoreCreditsMeResponse {
  credits:        unknown[];
  total:          number;
}

interface StoreCreditBadgeProps {
  /** Called with the credit amount to apply (0 when toggled off) */
  onApply?: (amount: number) => void;
}

export function StoreCreditBadge({ onApply }: StoreCreditBadgeProps) {
  const token = useAuthStore((s) => s.accessToken);

  const [balance, setBalance] = useState<number | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiClient
      .get<StoreCreditsMeResponse>(API_ROUTES.STORE_CREDITS.STORE_CREDITS_ME, {
        token: token ?? undefined,
      })
      .then((d) => setBalance(d.total))
      .catch(() => {});
  }, [token]);

  // Nothing to show if the user has no available credit
  if (!balance || balance <= 0) return null;

  const handleToggle = () => {
    const next = !applied;
    setApplied(next);
    onApply?.(next ? balance : 0);
  };

  return (
    <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm">
      <span className="text-green-800 font-medium">
        Store Credit:{' '}
        <strong>${balance.toFixed(2)}</strong> available
      </span>
      <button
        type="button"
        onClick={handleToggle}
        className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
          applied
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-white border border-green-400 text-green-700 hover:bg-green-50'
        }`}
      >
        {applied ? 'Applied' : 'Apply'}
      </button>
    </div>
  );
}
