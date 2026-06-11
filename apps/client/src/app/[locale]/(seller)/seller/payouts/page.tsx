'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, DollarSign, CheckCircle2, AlertTriangle, Wallet } from 'lucide-react';
import { Pagination, Skeleton } from '@mlh/ui';
import { useAuthQuery, useAuthMutation } from '../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@mlh/constants';
import { apiClient } from '@mlh/api-client';
import { fmtAmount } from '../../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PayoutStats {
  availableBalance:  number;
  pendingBalance:    number;
  paidThisMonth:     number;
  failedCount:       number;
  minimumPayout:     number;
}

interface Payout {
  id:            string;
  period:        string;
  amount:        number;
  orderCount:    number;
  status:        'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  paidAt:        string | null;
  paymentMethod: string | null;
  createdAt:     string;
}

interface PayoutsResponse {
  data:       Payout[];
  pagination: { page: number; totalPages: number; total: number };
}

interface WithdrawRequest {
  amount:        number;
  paymentMethod: string;
  paymentDetail: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID:       'bg-green-100 text-green-700',
  FAILED:     'bg-red-100 text-red-700',
};

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const PAYMENT_METHODS = ['PayPal', 'Bank Wire', 'USDT (TRC-20)', 'USDT (ERC-20)'];

// ── Withdraw modal ────────────────────────────────────────────────────────────

function WithdrawModal({
  available,
  minimum,
  onSubmit,
  onClose,
  isPending,
}: {
  available: number;
  minimum:   number;
  onSubmit:  (req: WithdrawRequest) => void;
  onClose:   () => void;
  isPending: boolean;
}) {
  const [amount,        setAmount       ] = useState('');
  const [method,        setMethod       ] = useState('PayPal');
  const [paymentDetail, setPaymentDetail] = useState('');

  const parsed = parseFloat(amount);
  const valid  = !isNaN(parsed) && parsed >= minimum && parsed <= available && paymentDetail.trim().length > 0;

  const placeholders: Record<string, string> = {
    'PayPal':        'Your PayPal email',
    'Bank Wire':     'Bank name, account number, routing number',
    'USDT (TRC-20)': 'Your TRC-20 wallet address',
    'USDT (ERC-20)': 'Your ERC-20 wallet address',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-card shadow-modal w-full max-w-md p-6 space-y-4">
        <div>
          <h3 className="font-semibold text-secondary text-base">Request Withdrawal</h3>
          <p className="text-xs text-muted mt-0.5">
            Available: <span className="font-semibold text-secondary">{fmtAmount(available)}</span>
            {' · '}Min: <span className="font-semibold">{fmtAmount(minimum)}</span>
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-secondary mb-1">
            Amount <span className="text-error">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
            <input
              type="number" min={minimum} max={available} step="0.01"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={minimum.toFixed(2)}
              className="w-full pl-7 pr-4 py-2.5 text-sm border border-border rounded-button focus:outline-none focus:border-primary"
            />
          </div>
          <button type="button" onClick={() => setAmount(available.toFixed(2))}
            className="text-xs text-primary hover:underline mt-1">
            Withdraw all ({fmtAmount(available)})
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-secondary mb-1">Payment method <span className="text-error">*</span></label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary">
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-secondary mb-1">
            Payment details <span className="text-error">*</span>
          </label>
          <input
            type="text" value={paymentDetail}
            onChange={(e) => setPaymentDetail(e.target.value)}
            placeholder={placeholders[method] ?? 'Enter payment details'}
            className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary"
          />
        </div>

        <p className="text-xs text-muted">Processed within 3–5 business days. No fees deducted.</p>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-border rounded-button text-secondary hover:border-muted transition-colors">
            Cancel
          </button>
          <button type="button"
            onClick={() => onSubmit({ amount: parsed, paymentMethod: method, paymentDetail })}
            disabled={!valid || isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-button hover:bg-primary/90 transition-colors disabled:opacity-40">
            {isPending ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SellerPayoutsPage() {
  const qc = useQueryClient();
  const [page,         setPage        ] = useState(1);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [successMsg,   setSuccessMsg  ] = useState('');

  const { data: payoutStats } = useAuthQuery<PayoutStats>(
    ['seller', 'payout-stats'],
    API_ROUTES.SELLER.PAYOUT_STATS,
  );

  const { data, isLoading } = useAuthQuery<PayoutsResponse>(
    ['seller', 'payouts', page],
    API_ROUTES.SELLER.PAYOUTS,
    { page, limit: 20 },
  );

  const withdrawMutation = useAuthMutation(
    (req: WithdrawRequest, token: string) =>
      apiClient.post(API_ROUTES.SELLER.PAYOUT_REQUEST, req, { token }),
    {
      invalidateKeys: [['seller', 'payout-stats'], ['seller', 'payouts']],
      onSuccess: () => {
        setShowWithdraw(false);
        setSuccessMsg('Withdrawal request submitted! You will receive confirmation within 24 hours.');
        setTimeout(() => setSuccessMsg(''), 6000);
      },
    },
  );

  const payouts    = data?.data                  ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const balance    = payoutStats?.availableBalance ?? 0;
  const minimum    = payoutStats?.minimumPayout    ?? 20;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold text-secondary">Payouts</h1>
        <button
          type="button"
          onClick={() => setShowWithdraw(true)}
          disabled={balance < minimum}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-bold text-sm rounded-button hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          <Wallet className="w-4 h-4" />
          Request Withdrawal
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-button text-sm text-green-700 font-medium">
          {successMsg}
        </div>
      )}

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Wallet,        label: 'Available',     value: fmtAmount(payoutStats?.availableBalance ?? 0), sub: balance < minimum ? `min. ${fmtAmount(minimum)}` : 'ready to withdraw', color: 'bg-green-500'  },
          { icon: Clock,        label: 'Pending',        value: fmtAmount(payoutStats?.pendingBalance   ?? 0), sub: 'unlocking soon',                                                        color: 'bg-amber-500' },
          { icon: CheckCircle2, label: 'Paid This Month', value: fmtAmount(payoutStats?.paidThisMonth    ?? 0), sub: 'completed',                                                             color: 'bg-blue-500'  },
          { icon: AlertTriangle, label: 'Failed',         value: String(payoutStats?.failedCount         ?? 0), sub: 'need attention',                                                        color: 'bg-red-500'   },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{label}</p>
              <p className="text-lg font-bold text-secondary tabular-nums">{value}</p>
              <p className="text-xs text-muted">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Payout history ────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-semibold text-secondary mb-4">Payout History</h2>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-16 rounded-card" />
            ))}
          </div>
        )}

        {!isLoading && payouts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border border-dashed border-border rounded-card">
            <Clock className="w-10 h-10 text-muted/30" />
            <p className="text-sm text-muted">No payouts yet. Your first payout will appear here once processed.</p>
          </div>
        )}

        {!isLoading && payouts.length > 0 && (
          <>
            <div className="space-y-2">
              {payouts.map((p) => (
                <div key={p.id}
                  className="flex items-center justify-between gap-4 p-4 border border-border rounded-card">
                  <div>
                    <p className="text-sm font-semibold text-secondary">{p.period}</p>
                    <p className="text-xs text-muted">
                      {p.orderCount} order{p.orderCount !== 1 ? 's' : ''}
                      {p.paidAt    && ` · Paid ${fmt.format(new Date(p.paidAt))}`}
                      {p.paymentMethod && ` via ${p.paymentMethod}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[p.status]}`}>
                      {p.status}
                    </span>
                    <span className="font-bold text-secondary tabular-nums">{fmtAmount(p.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              />
            )}
          </>
        )}
      </section>

      {showWithdraw && (
        <WithdrawModal
          available={balance}
          minimum={minimum}
          onSubmit={(req) => withdrawMutation.mutate(req)}
          onClose={() => setShowWithdraw(false)}
          isPending={withdrawMutation.isPending}
        />
      )}
    </div>
  );
}
