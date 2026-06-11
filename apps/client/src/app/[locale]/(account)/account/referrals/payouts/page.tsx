'use client';

import { useState } from 'react';
import { DollarSign, TrendingUp, Clock, Banknote } from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { useAuthQuery, useAuthMutation } from '../../../../../../lib/hooks/useAuthQuery';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { useAuthStore } from '../../../../../../lib/store/auth.store';

// ── Types ─────────────────────────────────────────────────────────────────────

type PayoutStatus  = 'PENDING' | 'PROCESSING' | 'PAID' | 'REJECTED';
type PayoutMethod  = 'paypal' | 'bank_transfer' | 'store_credit';

interface ReferralMe {
  referralCode:      string;
  confirmedBalance:  number;
  pendingBalance:    number;
  totalEarned:       number;
  settings?: {
    minPayoutAmount: number;
  };
}

interface Payout {
  id:        string;
  amount:    number;
  method:    PayoutMethod;
  status:    PayoutStatus;
  detail:    string | null;
  createdAt: string;
  paidAt:    string | null;
  note:      string | null;
}

interface PayoutsPage {
  data:       Payout[];
  total:      number;
  page:       number;
  totalPages: number;
}

interface PayoutRequest {
  amount: number;
  method: PayoutMethod;
  detail: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
function formatDate(d: string) { return fmt.format(new Date(d)); }

const PAYOUT_STATUS_BADGE: Record<PayoutStatus, { label: string; className: string }> = {
  PENDING:    { label: 'Pending',    className: 'bg-amber-100 text-amber-700' },
  PROCESSING: { label: 'Processing', className: 'bg-blue-100 text-blue-700'   },
  PAID:       { label: 'Paid',       className: 'bg-gray-100 text-gray-500'   },
  REJECTED:   { label: 'Rejected',   className: 'bg-red-100 text-red-600'     },
};

const METHOD_LABELS: Record<PayoutMethod, string> = {
  paypal:        'PayPal',
  bank_transfer: 'Bank Transfer',
  store_credit:  'Store Credit',
};

const METHOD_DETAIL_PLACEHOLDER: Record<PayoutMethod, string> = {
  paypal:        'Enter your PayPal email address',
  bank_transfer: 'Enter account number / IBAN',
  store_credit:  'Will be added to your store account',
};

const DEFAULT_MIN_PAYOUT = 20;

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-secondary',
}: {
  icon:   React.ElementType;
  label:  string;
  value:  string | number;
  sub?:   string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function PayoutsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-card p-5 space-y-2">
            <Skeleton variant="text" className="w-24" />
            <Skeleton variant="text" className="w-16 h-8" />
          </div>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-card p-5 space-y-3">
        <Skeleton variant="text" className="w-48" />
        <Skeleton variant="text" className="w-full h-10" />
        <Skeleton variant="text" className="w-full h-10" />
        <Skeleton variant="text" className="w-32 h-9" />
      </div>
    </div>
  );
}

// ── Payout request form ───────────────────────────────────────────────────────

function PayoutRequestForm({
  confirmedBalance,
  minPayout,
  onSuccess,
}: {
  confirmedBalance: number;
  minPayout:        number;
  onSuccess:        () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);

  const [method, setMethod]   = useState<PayoutMethod>('paypal');
  const [detail, setDetail]   = useState('');
  const [amount, setAmount]   = useState(confirmedBalance.toFixed(2));
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mutation = useAuthMutation<unknown, PayoutRequest>(
    (vars, tk) =>
      apiClient.post(API_ROUTES.REFERRALS.ME_PAYOUT_REQUEST, vars, { token: tk }),
    {
      invalidateKeys: [['referrals', 'me'], ['referrals', 'me', 'payouts']],
      onSuccess: () => {
        setSuccess(true);
        onSuccess();
      },
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < minPayout) {
      setError(`Minimum payout amount is $${minPayout.toFixed(2)}.`);
      return;
    }
    if (numAmount > confirmedBalance) {
      setError(`Amount exceeds your confirmed balance of $${confirmedBalance.toFixed(2)}.`);
      return;
    }
    if (method !== 'store_credit' && !detail.trim()) {
      setError('Please enter your payout details.');
      return;
    }

    mutation.mutate({ amount: numAmount, method, detail: detail.trim() });
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-card p-5 text-center space-y-2">
        <p className="text-sm font-semibold text-green-700">Payout request submitted!</p>
        <p className="text-xs text-green-600">
          We will process your request within 3–5 business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-secondary">Request a Payout</p>
        <p className="text-xs text-muted mt-0.5">
          Minimum payout: ${minPayout.toFixed(2)} &nbsp;·&nbsp; Available: ${confirmedBalance.toFixed(2)}
        </p>
      </div>

      {/* Method */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-1.5">Payout method</label>
        <select
          value={method}
          onChange={(e) => {
            setMethod(e.target.value as PayoutMethod);
            if (e.target.value === 'store_credit') setDetail('');
          }}
          className="w-full bg-[#FAFAF8] border border-border rounded-button px-3 py-2.5 text-sm text-secondary focus:outline-none focus:border-primary"
        >
          <option value="paypal">PayPal</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="store_credit">Store Credit</option>
        </select>
      </div>

      {/* Detail input */}
      {method !== 'store_credit' && (
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">
            {method === 'paypal' ? 'PayPal email' : 'Bank account details'}
          </label>
          <input
            type="text"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={METHOD_DETAIL_PLACEHOLDER[method]}
            className="w-full bg-[#FAFAF8] border border-border rounded-button px-3 py-2.5 text-sm text-secondary focus:outline-none focus:border-primary placeholder:text-muted"
          />
        </div>
      )}

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-1.5">Amount ($)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={minPayout}
            max={confirmedBalance}
            step="0.01"
            className="w-full bg-[#FAFAF8] border border-border rounded-button pl-7 pr-3 py-2.5 text-sm text-secondary focus:outline-none focus:border-primary tabular-nums"
          />
        </div>
        <button
          type="button"
          onClick={() => setAmount(confirmedBalance.toFixed(2))}
          className="mt-1 text-xs text-primary hover:underline"
        >
          Use full balance
        </button>
      </div>

      {error && (
        <p className="text-xs text-error bg-error/8 border border-error/20 rounded-button px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-button hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {mutation.isPending ? (
          <>
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Banknote className="w-4 h-4" />
            Request Payout
          </>
        )}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReferralPayoutsPage() {
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: me, isLoading: meLoading } = useAuthQuery<ReferralMe>(
    ['referrals', 'me', refreshKey],
    API_ROUTES.REFERRALS.ME,
  );

  const { data: payoutsPage, isLoading: payoutsLoading } = useAuthQuery<PayoutsPage>(
    ['referrals', 'me', 'payouts', page],
    API_ROUTES.REFERRALS.ME_PAYOUTS,
    { page, limit: 10 },
  );

  const isLoading   = meLoading || payoutsLoading;
  const minPayout   = me?.settings?.minPayoutAmount ?? DEFAULT_MIN_PAYOUT;
  const canRequest  = (me?.confirmedBalance ?? 0) >= minPayout;
  const totalPages  = payoutsPage?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">Payouts</h1>
        <p className="text-sm text-muted mt-1">
          Request a payout of your confirmed referral balance.
        </p>
      </div>

      {isLoading && <PayoutsSkeleton />}

      {me && (
        <>
          {/* ── Balance cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={DollarSign}
              label="Confirmed balance"
              value={`$${me.confirmedBalance.toFixed(2)}`}
              sub={canRequest ? 'Available to withdraw' : `Min $${minPayout.toFixed(2)} to withdraw`}
              color="text-green-700"
            />
            <StatCard
              icon={Clock}
              label="Pending earnings"
              value={`$${me.pendingBalance.toFixed(2)}`}
              sub="Locks after order fulfillment"
            />
            <StatCard
              icon={TrendingUp}
              label="All-time earned"
              value={`$${me.totalEarned.toFixed(2)}`}
            />
          </div>

          {/* ── Payout form or "not enough balance" notice ─────────────────── */}
          {canRequest ? (
            <PayoutRequestForm
              confirmedBalance={me.confirmedBalance}
              minPayout={minPayout}
              onSuccess={() => setRefreshKey((k) => k + 1)}
            />
          ) : (
            <div className="bg-[#FAFAF8] border border-border rounded-card p-5 text-center space-y-2">
              <p className="text-sm font-semibold text-secondary">Not enough balance yet</p>
              <p className="text-xs text-muted">
                You need at least ${minPayout.toFixed(2)} in confirmed balance to request a payout.
                Keep sharing your referral link to earn more!
              </p>
            </div>
          )}

          {/* ── Payout history ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-base font-semibold text-secondary mb-3">Payout History</h2>

            {payoutsLoading && (
              <div className="border border-border rounded-card overflow-hidden">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0">
                    <div className="space-y-1.5">
                      <Skeleton variant="text" className="w-36" />
                      <Skeleton variant="text" className="w-24" />
                    </div>
                    <Skeleton variant="text" className="w-16" />
                  </div>
                ))}
              </div>
            )}

            {!payoutsLoading && payoutsPage && (
              payoutsPage.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <Banknote className="w-10 h-10 text-muted/30" />
                  <p className="text-sm text-muted">No payout requests yet.</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block border border-border rounded-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#FAFAF8] border-b border-border">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Date</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Amount</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Method</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payoutsPage.data.map((p) => {
                          const badge = PAYOUT_STATUS_BADGE[p.status];
                          return (
                            <tr
                              key={p.id}
                              className="border-b border-border last:border-0 hover:bg-surface transition-colors"
                            >
                              <td className="px-5 py-4 text-secondary">
                                <div>
                                  {formatDate(p.createdAt)}
                                  {p.paidAt && (
                                    <p className="text-xs text-muted">Paid {formatDate(p.paidAt)}</p>
                                  )}
                                  {p.note && (
                                    <p className="text-xs text-muted italic">{p.note}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-4 text-right font-bold tabular-nums text-secondary">
                                ${p.amount.toFixed(2)}
                              </td>
                              <td className="px-5 py-4 text-secondary">
                                {METHOD_LABELS[p.method]}
                                {p.detail && (
                                  <p className="text-xs text-muted truncate max-w-[160px]">{p.detail}</p>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                                  {badge.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile card list */}
                  <div className="sm:hidden border border-border rounded-card overflow-hidden divide-y divide-border">
                    {payoutsPage.data.map((p) => {
                      const badge = PAYOUT_STATUS_BADGE[p.status];
                      return (
                        <div key={p.id} className="px-4 py-4 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-secondary">
                                ${p.amount.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted">{formatDate(p.createdAt)}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                              {badge.label}
                            </span>
                          </div>
                          <p className="text-xs text-secondary">
                            {METHOD_LABELS[p.method]}
                            {p.detail ? ` · ${p.detail}` : ''}
                          </p>
                          {p.note && <p className="text-xs text-muted italic">{p.note}</p>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm mt-4">
                      <p className="text-muted text-xs">
                        Page {page} of {totalPages} &nbsp;·&nbsp; {payoutsPage.total} total
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((pg) => Math.max(1, pg - 1))}
                          disabled={page <= 1}
                          className="px-3 py-1.5 border border-border rounded-button text-xs font-medium text-secondary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage((pg) => Math.min(totalPages, pg + 1))}
                          disabled={page >= totalPages}
                          className="px-3 py-1.5 border border-border rounded-button text-xs font-medium text-secondary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
