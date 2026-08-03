'use client';

import { ShoppingCart, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { API_ROUTES } from '@ezihubb/constants';
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
    case 'BUYER_REFERRAL': return 'Referral bonus';
    case 'ADMIN_GRANT':    return 'Admin grant';
    case 'RETURN_CREDIT':  return 'Return credit';
    default:               return reason.replace(/_/g, ' ').toLowerCase();
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StoreCreditWidget() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useAuthQuery<StoreCreditsMeResponse>(
    ['account', 'store-credits'],
    API_ROUTES.STORE_CREDITS.STORE_CREDITS_ME,
  );

  if (isLoading || !data) return null;

  const activeCredit = data.credits.find(c => !c.usedAt && Number(c.amount) > 0);

  const handleCopyLink = () => {
    const url = window.location.origin + '/account/referrals';
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4" style={{ borderColor: '#E8E4DF' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Store credit</h3>
        <a href="/account/referrals" className="text-xs font-medium" style={{ color: '#E85D3F' }}>
          How to earn more →
        </a>
      </div>

      {activeCredit ? (
        /* ── Active credit state ─────────────────────────────────────── */
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold" style={{ color: '#2E7D52' }}>
            {fmtAmount(Number(activeCredit.amount))}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Earned: {sourceLabel(activeCredit.reason)}</p>
            {activeCredit.expiresAt && (
              <p className="text-xs font-medium" style={{ color: '#D97706' }}>
                Expires: {new Date(activeCredit.expiresAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </p>
            )}
          </div>
          <a
            href="/cart"
            className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold text-white"
            style={{ background: '#E85D3F' }}
          >
            Use at checkout
          </a>
        </div>
      ) : (
        /* ── Empty state ─────────────────────────────────────────────── */
        <div className="text-center py-4 space-y-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <ShoppingCart className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">No store credit yet</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Share your purchase link to earn $4 when a friend buys
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: '#E85D3F' }}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy your link'}
          </button>
        </div>
      )}

      {/* All credits list (when multiple) */}
      {data.credits.length > 1 && (
        <ul className="divide-y text-sm" style={{ borderColor: '#E8E4DF' }}>
          {data.credits.slice(0, 4).map((credit) => (
            <li key={credit.id} className="flex justify-between py-2 gap-3">
              <span className="text-gray-600 capitalize">{sourceLabel(credit.reason)}</span>
              <span className={`font-medium tabular-nums shrink-0 ${credit.usedAt ? 'text-gray-400 line-through' : ''}`}
                style={!credit.usedAt ? { color: '#2E7D52' } : undefined}>
                {fmtAmount(Number(credit.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
