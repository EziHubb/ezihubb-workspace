'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../../../../lib/store/auth.store';
import { apiClient } from '@mlh/api-client';
import { useAuthQuery } from '../../../../../../lib/hooks/useAuthQuery';

interface DashboardData {
  balance:     number;
  totalEarned: number;
}

interface PayoutRow {
  id:            string;
  amount:        number;
  status:        string;
  paymentMethod: string;
  paymentDetail: string;
  createdAt:     string;
  processedAt:   string | null;
}

const PAYOUT_STATUS_COLORS: Record<string, string> = {
  REQUESTED:  'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID:       'bg-green-100 text-green-700',
  REJECTED:   'bg-red-100 text-red-700',
};

const METHODS = [
  { value: 'paypal',         label: 'PayPal',         placeholder: 'your@paypal.com' },
  { value: 'bank_transfer',  label: 'Bank transfer',  placeholder: 'Account number / routing / IBAN' },
  { value: 'store_credit',   label: 'Store credit',   placeholder: 'Email for store credit code' },
] as const;

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDate = (d: string) => fmt.format(new Date(d));

const MIN_PAYOUT = 50;

export default function AffiliatePayoutsPage() {
  const token      = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading: dashLoading } = useAuthQuery<DashboardData>(
    ['affiliate-dashboard'],
    '/affiliates/me/dashboard',
  );

  const { data: payouts, isLoading: payoutsLoading } = useAuthQuery<PayoutRow[]>(
    ['affiliate-payouts'],
    '/affiliates/me/payouts',
  );

  const [method,        setMethod]        = useState<string>(METHODS[0].value);
  const [detail,        setDetail]        = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [formError,     setFormError]     = useState('');
  const [formSuccess,   setFormSuccess]   = useState(false);

  const balance    = dashboard?.balance    ?? 0;
  const totalEarned = dashboard?.totalEarned ?? 0;
  const pendingLocked = Math.max(0, totalEarned - balance);

  // Auto-fill amount when balance changes
  const effectiveAmount = requestAmount || balance.toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const amount = parseFloat(effectiveAmount);
    if (isNaN(amount) || amount <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }
    if (!detail.trim()) {
      setFormError('Please provide payment details.');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post(
        '/affiliates/me/payouts',
        { paymentMethod: method, paymentDetail: detail, amount },
        { token: token ?? undefined },
      );
      setFormSuccess(true);
      setDetail('');
      setRequestAmount('');
      // Invalidate dashboard + payouts so balance updates
      void queryClient.invalidateQueries({ queryKey: ['affiliate-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['affiliate-payouts'] });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Request failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = dashLoading || payoutsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-secondary">Payouts</h1>

      {/* ── Balance summary ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Confirmed balance', value: `$${balance.toFixed(2)}`,      note: 'Ready to withdraw'          },
          { label: 'Pending (locked)',  value: `$${pendingLocked.toFixed(2)}`, note: `${14}-day lock after delivery` },
          { label: 'All-time earned',   value: `$${totalEarned.toFixed(2)}`,   note: 'Paid + confirmed'           },
        ].map(({ label, value, note }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4 text-center">
            <p className="text-xs text-muted mb-1">{label}</p>
            <p className="font-display text-2xl font-bold text-secondary tabular-nums">{value}</p>
            <p className="text-xs text-muted mt-0.5">{note}</p>
          </div>
        ))}
      </div>

      {/* ── Request payout form ──────────────────────────────────────────────── */}
      {balance >= MIN_PAYOUT ? (
        <div className="bg-surface border border-border rounded-card p-5">
          <h2 className="font-semibold text-secondary mb-4 text-sm">Request payout</h2>

          {formSuccess && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-sm text-sm text-green-700">
              Payout request submitted! We&apos;ll process it manually and confirm by email.
            </div>
          )}

          {formError && (
            <div role="alert" className="mb-4 p-3 bg-error/5 border border-error/20 rounded-sm text-sm text-error">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">
                Payment method
              </label>
              <div className="flex flex-wrap gap-2">
                {METHODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => { setMethod(m.value); setDetail(''); }}
                    className={[
                      'px-4 py-2 rounded-button text-sm font-medium border transition-colors',
                      method === m.value
                        ? 'bg-primary text-white border-primary'
                        : 'border-border text-secondary hover:border-primary',
                    ].join(' ')}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Detail */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">
                Payment details
              </label>
              <input
                type="text"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={METHODS.find((m) => m.value === method)?.placeholder ?? ''}
                required
                className="w-full border border-border rounded-button px-4 py-2.5 text-sm text-secondary bg-background placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-1.5">
                Amount (max ${balance.toFixed(2)})
              </label>
              <div className="flex items-center gap-2">
                <span className="text-muted text-sm font-medium">$</span>
                <input
                  type="number"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  placeholder={balance.toFixed(2)}
                  min={MIN_PAYOUT}
                  max={balance}
                  step="0.01"
                  className="flex-1 border border-border rounded-button px-4 py-2.5 text-sm text-secondary bg-background placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setRequestAmount(balance.toFixed(2))}
                  className="text-xs text-primary hover:underline whitespace-nowrap"
                >
                  Full balance
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-bold text-sm px-6 py-3 rounded-button transition-colors uppercase tracking-wide"
            >
              {isSubmitting ? 'Submitting…' : 'Request payout'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-card p-6 text-center">
          <p className="text-secondary font-medium mb-1">
            ${(MIN_PAYOUT - balance).toFixed(2)} more to reach the payout minimum
          </p>
          <p className="text-sm text-muted">
            Payouts are processed manually once your balance reaches ${MIN_PAYOUT}.
          </p>
        </div>
      )}

      {/* ── Payout history ───────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-secondary text-sm">Payout history</h2>
        </div>

        {!payouts || payouts.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted text-center">No payouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">Method</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Amount</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background transition-colors">
                    <td className="px-5 py-3 text-muted whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                    <td className="px-5 py-3 text-secondary capitalize whitespace-nowrap">
                      {p.paymentMethod.replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-secondary tabular-nums">
                      ${Number(p.amount).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${PAYOUT_STATUS_COLORS[p.status] ?? 'bg-muted/10 text-muted'}`}>
                        {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
