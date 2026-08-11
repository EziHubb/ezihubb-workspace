'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DollarSign, AlertCircle } from 'lucide-react';
import { Skeleton } from '@ezihubb/ui';
import { useAuthQuery, useAuthMutation } from '../../../../../../lib/hooks/useAuthQuery';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, safeArr, safeNum, safeStr } from '@ezihubb/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreatorMe {
  confirmedBalance: number;
  pendingBalance:   number;
}

interface WithdrawalInput {
  amount:        number;
  paymentMethod: string;
  paymentDetail: string;
}

interface Withdrawal {
  id:            string;
  amount:        number;
  status:        'REQUESTED' | 'PROCESSING' | 'PAID' | 'REJECTED';
  paymentMethod: string;
  paymentDetail: string;
  adminNotes:    string | null;
  createdAt:     string;
  processedAt:   string | null;
}

interface WithdrawalsPage {
  data:       Withdrawal[];
  total:      number;
  page:       number;
  totalPages: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MINIMUM_PAYOUT = 20;

const STATUS_COLORS: Record<Withdrawal['status'], string> = {
  REQUESTED:  'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID:       'bg-green-100 text-green-700',
  REJECTED:   'bg-red-100 text-red-700',
};

function usePaymentMethods(t: ReturnType<typeof useTranslations>) {
  return [
    { value: 'PAYPAL',      label: t('payoutsPage.methods.paypal'),     placeholder: t('payoutsPage.methodPlaceholders.paypal') },
    { value: 'BANK_WIRE',   label: t('payoutsPage.methods.bankWire'),   placeholder: t('payoutsPage.methodPlaceholders.bankWire') },
    { value: 'CRYPTO_USDT', label: t('payoutsPage.methods.cryptoUsdt'), placeholder: t('payoutsPage.methodPlaceholders.cryptoUsdt') },
  ];
}

// ── Withdrawal form ───────────────────────────────────────────────────────────

function WithdrawalForm({ balance: rawBalance, onSuccess }: { balance: number; onSuccess: () => void }) {
  const t = useTranslations('creator.creator');
  const balance = safeNum(rawBalance);
  const paymentMethods = usePaymentMethods(t);
  const [amount,  setAmount]  = useState('');
  const [method,  setMethod]  = useState(paymentMethods[0].value);
  const [detail,  setDetail]  = useState('');
  const [error,   setError]   = useState('');

  const selectedMethod = paymentMethods.find((m) => m.value === method)!;

  const { mutateAsync, isPending } = useAuthMutation<unknown, WithdrawalInput>(
    (vars, token) => apiClient.post(API_ROUTES.CREATORS.ME_WITHDRAWAL_REQ, vars, { token }),
  );

  const canSubmit = balance >= MINIMUM_PAYOUT;
  const numAmount = parseFloat(amount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!numAmount || numAmount <= 0) { setError(t('payoutsPage.errorInvalidAmount')); return; }
    if (numAmount > balance) { setError(t('payoutsPage.errorExceedsBalance', { amount: fmtAmount(balance) })); return; }
    if (numAmount < MINIMUM_PAYOUT) { setError(t('payoutsPage.errorBelowMinimum', { amount: fmtAmount(MINIMUM_PAYOUT) })); return; }
    if (!detail.trim()) { setError(t('payoutsPage.errorDetailRequired')); return; }
    try {
      await mutateAsync({ amount: numAmount, paymentMethod: method, paymentDetail: detail.trim() });
      setAmount('');
      setDetail('');
      onSuccess();
    } catch (err) {
      setError((err as Error).message ?? t('payoutsPage.errorGeneric'));
    }
  };

  return (
    <div className="bg-surface border border-border rounded-card p-5 space-y-5">
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-secondary">{t('payoutsPage.requestTitle')}</h2>
      </div>

      {!canSubmit ? (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-card">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">
            {t.rich('payoutsPage.minWithdrawalNotice', {
              amount: fmtAmount(MINIMUM_PAYOUT),
              balance: fmtAmount(balance),
              b: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-card">
            <p className="text-sm text-green-700">
              {t.rich('payoutsPage.availableToWithdraw', {
                amount: fmtAmount(balance),
                b: (chunks) => <strong className="text-green-800">{chunks}</strong>,
              })}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              {t('payoutsPage.amountLabel')} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-bold">$</span>
              <input
                type="number" min={MINIMUM_PAYOUT} max={balance} step="0.01"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder={MINIMUM_PAYOUT.toFixed(2)}
                className="w-full pl-7 pr-4 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[25, 50, 100].map((v) => (
                <button key={v} type="button" onClick={() => setAmount(Math.min(v, balance).toFixed(2))}
                  disabled={balance < v}
                  className="px-2.5 py-1 text-xs font-medium border border-border rounded-button text-muted hover:border-primary/40 hover:text-secondary disabled:opacity-30 transition-colors">
                  ${v}
                </button>
              ))}
              <button type="button" onClick={() => setAmount(balance.toFixed(2))}
                className="px-2.5 py-1 text-xs font-medium border border-border rounded-button text-muted hover:border-primary/40 hover:text-secondary transition-colors">
                {t('payoutsPage.max')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              {t('payoutsPage.paymentMethodLabel')} <span className="text-red-400">*</span>
            </label>
            <select value={method} onChange={(e) => { setMethod(e.target.value); setDetail(''); }}
              className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
              {paymentMethods.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              {t('payoutsPage.paymentDetailsLabel')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text" value={detail} onChange={(e) => setDetail(e.target.value)}
              placeholder={selectedMethod.placeholder}
              className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-button">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <button type="submit" disabled={isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-button hover:bg-primary/90 disabled:opacity-50 transition-colors">
            <DollarSign className="w-4 h-4" />
            {isPending ? t('payoutsPage.submitting') : t('payoutsPage.submitButton')}
          </button>

          <p className="text-xs text-muted">
            {t('payoutsPage.processingNotice')}
          </p>
        </form>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreatorPayoutsPage() {
  const locale = useLocale();
  const t = useTranslations('creator.creator');
  const tCommon = useTranslations('common');

  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDate = (d: string) => fmt.format(new Date(d));

  const [page, setPage]       = useState(1);
  const [success, setSuccess] = useState(false);

  const { data: me, isLoading: meLoading, refetch: refetchMe } = useAuthQuery<CreatorMe>(
    ['creator', 'me', 'balance'],
    API_ROUTES.CREATORS.ME,
  );

  const { data: withdrawals, isLoading: withdrawalsLoading, refetch: refetchWithdrawals } = useAuthQuery<WithdrawalsPage>(
    ['creator', 'me', 'withdrawals', page],
    API_ROUTES.CREATORS.ME_WITHDRAWALS,
    { page, limit: 10 },
  );

  const handleSuccess = () => {
    setSuccess(true);
    void refetchMe();
    void refetchWithdrawals();
    setTimeout(() => setSuccess(false), 5000);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">{t('payoutsPage.pageTitle')}</h1>
        <p className="text-sm text-muted mt-1">
          {t('payoutsPage.pageSubtitle')}
        </p>
      </div>

      {success && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-card">
          <DollarSign className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">
            {t('payoutsPage.successBanner')}
          </p>
        </div>
      )}

      {/* ── Balance + Form ────────────────────────────────────────────────────── */}
      {meLoading ? (
        <div className="bg-surface border border-border rounded-card p-5 space-y-4">
          <Skeleton variant="text" className="w-48" />
          <Skeleton variant="text" className="w-full h-10" />
          <Skeleton variant="text" className="w-32 h-10" />
        </div>
      ) : me ? (
        <WithdrawalForm
          balance={me.confirmedBalance}
          onSuccess={handleSuccess}
        />
      ) : null}

      {/* ── Withdrawal history ────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-secondary mb-3">{t('withdraw.history')}</h2>

        {withdrawalsLoading ? (
          <div className="border border-border rounded-card overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0">
                <div className="space-y-1.5">
                  <Skeleton variant="text" className="w-40" />
                  <Skeleton variant="text" className="w-24" />
                </div>
                <Skeleton variant="text" className="w-16" />
              </div>
            ))}
          </div>
        ) : !withdrawals || safeArr(withdrawals.data).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <DollarSign className="w-10 h-10 text-muted/30" />
            <p className="text-sm text-muted">{t('payoutsPage.noWithdrawals')}</p>
          </div>
        ) : (
          <>
            <div className="border border-border rounded-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-[#FAFAF8]">
                      {[
                        t('payoutsPage.tableRequested'),
                        t('payoutsPage.tableAmount'),
                        t('payoutsPage.tableMethod'),
                        t('payoutsPage.tableDetail'),
                        t('payoutsPage.tableStatus'),
                        t('payoutsPage.tableProcessed'),
                      ].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {safeArr(withdrawals.data).map((w) => {
                      const methodKey = w.paymentMethod === 'PAYPAL' ? 'paypal' : w.paymentMethod === 'BANK_WIRE' ? 'bankWire' : 'cryptoUsdt';
                      return (
                      <tr key={w.id} className="hover:bg-surface transition-colors">
                        <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{formatDate(w.createdAt)}</td>
                        <td className="px-4 py-3 font-bold tabular-nums text-secondary">{fmtAmount(w.amount)}</td>
                        <td className="px-4 py-3 text-xs text-secondary">{t(`payoutsPage.methods.${methodKey}` as 'payoutsPage.methods.paypal')}</td>
                        <td className="px-4 py-3 text-xs text-muted font-mono truncate max-w-[160px]">{w.paymentDetail}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit ${STATUS_COLORS[w.status]}`}>
                              {t(`payoutsPage.status.${safeStr(w.status).toLowerCase()}` as 'payoutsPage.status.requested')}
                            </span>
                            {w.adminNotes && (
                              <p className="text-[11px] text-muted truncate max-w-[160px]" title={w.adminNotes}>{w.adminNotes}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                          {w.processedAt ? formatDate(w.processedAt) : '—'}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {withdrawals.total > 10 && (
              <div className="flex items-center justify-between mt-3">
                <p className="text-sm text-muted">{t('payoutsPage.totalCount', { count: withdrawals.total })}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-3 py-1.5 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors">
                    {tCommon('previous')}
                  </button>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={safeArr(withdrawals.data).length < 10}
                    className="px-3 py-1.5 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors">
                    {tCommon('next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
