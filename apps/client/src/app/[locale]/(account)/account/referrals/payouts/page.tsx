'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DollarSign, TrendingUp, Clock, Banknote } from 'lucide-react';
import { Skeleton } from '@ezihubb/ui';
import { useAuthQuery, useAuthMutation } from '../../../../../../lib/hooks/useAuthQuery';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useAuthStore } from '../../../../../../lib/store/auth.store';
import { fmtAmount, safeArr, safeNum } from '@ezihubb/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type PayoutStatus  = 'PENDING' | 'PROCESSING' | 'PAID' | 'REJECTED';
type PayoutMethod  = 'paypal' | 'bank_transfer';

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

const STATUS_CLASSNAMES: Record<PayoutStatus, string> = {
  PENDING:    'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID:       'bg-gray-100 text-gray-500',
  REJECTED:   'bg-red-100 text-red-600',
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
  confirmedBalance: rawConfirmedBalance,
  minPayout,
  onSuccess,
}: {
  confirmedBalance: number;
  minPayout:        number;
  onSuccess:        () => void;
}) {
  const t = useTranslations('account.referrals');
  const confirmedBalance = safeNum(rawConfirmedBalance);
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
      setError(t('payouts.errorMinAmount', { amount: fmtAmount(minPayout) }));
      return;
    }
    if (numAmount > confirmedBalance) {
      setError(t('payouts.errorExceedsBalance', { amount: fmtAmount(confirmedBalance) }));
      return;
    }
    if (!detail.trim()) {
      setError(t('payouts.errorDetailRequired'));
      return;
    }

    mutation.mutate({ amount: numAmount, method, detail: detail.trim() });
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-card p-5 text-center space-y-2">
        <p className="text-sm font-semibold text-green-700">{t('payouts.successTitle')}</p>
        <p className="text-xs text-green-600">
          {t('payouts.successBody')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-secondary">{t('payouts.requestTitle')}</p>
        <p className="text-xs text-muted mt-0.5">
          {t('payouts.minAndAvailable', { min: fmtAmount(minPayout), available: fmtAmount(confirmedBalance) })}
        </p>
      </div>

      {/* Method */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-1.5">{t('payouts.methodLabel')}</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PayoutMethod)}
          className="w-full bg-[#FAFAF8] border border-border rounded-button px-3 py-2.5 text-sm text-secondary focus:outline-none focus:border-primary"
        >
          <option value="paypal">{t('payouts.methodPaypal')}</option>
          <option value="bank_transfer">{t('payouts.methodBank')}</option>
        </select>
      </div>

      {/* Detail input */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-1.5">
          {method === 'paypal' ? t('payouts.detailLabelPaypal') : t('payouts.detailLabelBank')}
        </label>
        <input
          type="text"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder={method === 'paypal' ? t('payouts.detailPlaceholderPaypal') : t('payouts.detailPlaceholderBank')}
          className="w-full bg-[#FAFAF8] border border-border rounded-button px-3 py-2.5 text-sm text-secondary focus:outline-none focus:border-primary placeholder:text-muted"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-1.5">{t('payouts.amountLabel')}</label>
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
          {t('payouts.useFullBalance')}
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
            {t('payouts.submitting')}
          </>
        ) : (
          <>
            <Banknote className="w-4 h-4" />
            {t('payouts.requestButton')}
          </>
        )}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReferralPayoutsPage() {
  const locale = useLocale();
  const t = useTranslations('account.referrals');
  const tCommon = useTranslations('common');

  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDate = (d: string) => fmt.format(new Date(d));

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
        <h1 className="font-display text-2xl font-bold text-secondary">{t('payouts.title')}</h1>
        <p className="text-sm text-muted mt-1">
          {t('payouts.subtitle')}
        </p>
      </div>

      {isLoading && <PayoutsSkeleton />}

      {me && (
        <>
          {/* ── Balance cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={DollarSign}
              label={t('payouts.confirmedBalance')}
              value={fmtAmount(me.confirmedBalance)}
              sub={canRequest ? t('payouts.availableToWithdraw') : t('payouts.minToWithdraw', { amount: fmtAmount(minPayout) })}
              color="text-green-700"
            />
            <StatCard
              icon={Clock}
              label={t('payouts.pendingEarnings')}
              value={fmtAmount(me.pendingBalance)}
              sub={t('payouts.locksAfterFulfillment')}
            />
            <StatCard
              icon={TrendingUp}
              label={t('payouts.allTimeEarned')}
              value={fmtAmount(me.totalEarned)}
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
              <p className="text-sm font-semibold text-secondary">{t('payouts.notEnoughTitle')}</p>
              <p className="text-xs text-muted">
                {t('payouts.notEnoughBody', { amount: fmtAmount(minPayout) })}
              </p>
            </div>
          )}

          {/* ── Payout history ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-base font-semibold text-secondary mb-3">{t('payouts.historyTitle')}</h2>

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
              safeArr(payoutsPage.data).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <Banknote className="w-10 h-10 text-muted/30" />
                  <p className="text-sm text-muted">{t('payouts.noPayouts')}</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden sm:block border border-border rounded-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#FAFAF8] border-b border-border">
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">{t('payouts.tableDate')}</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">{t('payouts.tableAmount')}</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">{t('payouts.tableMethod')}</th>
                          <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">{t('payouts.tableStatus')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {safeArr(payoutsPage.data).map((p) => {
                          const badgeClassName = STATUS_CLASSNAMES[p.status];
                          const badgeLabel = t(`payouts.status.${p.status.toLowerCase()}` as 'payouts.status.pending');
                          const methodLabel = p.method === 'paypal' ? t('payouts.methodPaypal') : t('payouts.methodBank');
                          return (
                            <tr
                              key={p.id}
                              className="border-b border-border last:border-0 hover:bg-surface transition-colors"
                            >
                              <td className="px-5 py-4 text-secondary">
                                <div>
                                  {formatDate(p.createdAt)}
                                  {p.paidAt && (
                                    <p className="text-xs text-muted">{t('payouts.paidOn', { date: formatDate(p.paidAt) })}</p>
                                  )}
                                  {p.note && (
                                    <p className="text-xs text-muted italic">{p.note}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-4 text-right font-bold tabular-nums text-secondary">
                                {fmtAmount(p.amount)}
                              </td>
                              <td className="px-5 py-4 text-secondary">
                                {methodLabel}
                                {p.detail && (
                                  <p className="text-xs text-muted truncate max-w-[160px]">{p.detail}</p>
                                )}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeClassName}`}>
                                  {badgeLabel}
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
                    {safeArr(payoutsPage.data).map((p) => {
                      const badgeClassName = STATUS_CLASSNAMES[p.status];
                      const badgeLabel = t(`payouts.status.${p.status.toLowerCase()}` as 'payouts.status.pending');
                      const methodLabel = p.method === 'paypal' ? t('payouts.methodPaypal') : t('payouts.methodBank');
                      return (
                        <div key={p.id} className="px-4 py-4 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-secondary">
                                {fmtAmount(p.amount)}
                              </p>
                              <p className="text-xs text-muted">{formatDate(p.createdAt)}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeClassName}`}>
                              {badgeLabel}
                            </span>
                          </div>
                          <p className="text-xs text-secondary">
                            {methodLabel}
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
                        {t('payouts.pageOf', { page, totalPages })} &nbsp;·&nbsp; {t('payouts.totalCount', { count: payoutsPage.total })}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPage((pg) => Math.max(1, pg - 1))}
                          disabled={page <= 1}
                          className="px-3 py-1.5 border border-border rounded-button text-xs font-medium text-secondary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {tCommon('previous')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage((pg) => Math.min(totalPages, pg + 1))}
                          disabled={page >= totalPages}
                          className="px-3 py-1.5 border border-border rounded-button text-xs font-medium text-secondary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {tCommon('next')}
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
