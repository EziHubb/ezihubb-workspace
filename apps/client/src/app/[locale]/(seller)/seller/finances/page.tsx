'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Clock, CheckCircle2, AlertCircle, ArrowRight, Landmark, Receipt } from 'lucide-react';
import { useFinancesOverview, useFinancesActivitySummary, useFinancesActivities } from '@ezihubb/api-client';
import { fmtAmount } from '@ezihubb/utils';
import { FinancesSubNav } from '../../../../../components/seller/FinancesSubNav';
import { ActivitySummaryCard } from '../../../../../components/seller/finances/ActivitySummaryCard';
import { TooltipTerm } from '../../../../../components/seller/finances/InfoTooltip';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

export default function PaymentAccountPage() {
  const t = useTranslations('seller.finances.paymentAccount');
  const tType = useTranslations('seller.finances.ledgerType');
  const locale = useLocale();

  const { data: overview, isLoading: ovLoading } = useFinancesOverview();
  const { data: summary, isLoading: sumLoading } = useFinancesActivitySummary();
  const { data: recent } = useFinancesActivities(undefined, undefined, 1, 5);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div>
      <h1 className="text-xl font-bold text-secondary mb-1">{t('title')}</h1>
      <FinancesSubNav />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-8">
        {/* Balance card */}
        <div className="bg-surface border border-border rounded-card p-6">
          {ovLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted mb-1">{t('current')}</p>
                  <p className={`text-3xl font-bold ${(overview?.current ?? 0) < 0 ? 'text-error' : 'text-secondary'}`}>
                    {fmtAmount(overview?.current ?? 0)}
                  </p>
                  <p className="text-xs text-muted mt-1">{t('currentDesc')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted mb-1">{t('pending')}</p>
                  <p className="text-3xl font-bold text-secondary">{fmtAmount(overview?.pending ?? 0)}</p>
                  <p className="text-xs text-muted mt-1">{t('noPending')}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-muted mb-1">{t('total')}</p>
                  <p className="text-xs text-muted">{t('totalDesc')}</p>
                </div>
                <p className={`text-xl font-bold ${(overview?.total ?? 0) < 0 ? 'text-error' : 'text-secondary'}`}>
                  {fmtAmount(overview?.total ?? 0)}
                </p>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border text-sm">
                <span className="text-muted">{t('depositNote')}</span>
              </div>
            </>
          )}
        </div>

        {/* Right column: deposit + billing status */}
        <div className="space-y-4">
          <div className="bg-surface border border-border rounded-card p-5">
            {overview?.hasFundsReadyForDeposit ? (
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-sm font-bold text-secondary">{t('fundsReady')}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-secondary shrink-0" />
                <span className="text-sm font-bold text-secondary">{t('noFundsReady')}</span>
              </div>
            )}
            <p className="text-xs text-muted mb-3">
              {t('noFundsReadyDesc', { amount: fmtAmount(overview?.depositMinAmount ?? 2) })}
            </p>
            <Link
              href={`/${locale}/seller/finances/payment-settings`}
              className="flex items-center justify-between text-xs font-medium text-secondary hover:text-primary transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-muted" />
                {t('depositSettings')}
              </span>
              <span className="flex items-center gap-1 text-muted">
                {overview?.bankAccount
                  ? t(`schedule.${overview.bankAccount.depositSchedule}`)
                  : t('notSet')}
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>

          <div className="bg-surface border border-border rounded-card p-5">
            <div className="flex items-center gap-2 mb-2">
              {overview?.nothingDueThisMonth ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-warning shrink-0" />
              )}
              <span className="text-sm font-bold text-secondary">
                {overview?.nothingDueThisMonth
                  ? t('nothingDue', { month: monthLabel })
                  : t('somethingDue', { amount: fmtAmount(overview?.amountDueThisMonth ?? 0), month: monthLabel })}
              </span>
            </div>
            <p className="text-xs text-muted mb-3">
              {overview?.nothingDueThisMonth ? t('nothingDueDesc') : t('somethingDueDesc')}
            </p>
            <Link
              href={`/${locale}/seller/finances/payment-settings?tab=billing`}
              className="flex items-center justify-between text-xs font-medium text-secondary hover:text-primary transition-colors"
            >
              <span>{t('autoBilling')}</span>
              <span className="flex items-center gap-1 text-muted">
                {overview?.defaultCard
                  ? t('cardEnding', { last4: overview.defaultCard.last4 })
                  : t('notSet')}
                <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
        </div>
      </div>

      {sumLoading || !summary ? (
        <Skeleton className="h-64 mb-8" />
      ) : (
        <div className="mb-8">
          <ActivitySummaryCard summary={summary} monthLabel={monthLabel} />
        </div>
      )}

      {/* Recent activities */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-secondary">{t('recentActivities')}</h2>
          <Link
            href={`/${locale}/seller/finances/statements`}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            {t('seeFullHistory')} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-sm text-secondary mb-4">
          {t.rich('totalBalanceText', {
            amount: fmtAmount(overview?.current ?? 0),
            tb: (chunks) => <TooltipTerm tooltip={t('totalBalanceTooltip')}>{chunks}</TooltipTerm>,
            amt: (chunks) => (
              <span className={(overview?.current ?? 0) < 0 ? 'text-error font-bold' : 'text-secondary font-bold'}>
                {chunks}
              </span>
            ),
          })}
        </p>

        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs">{t('table.type')}</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs">{t('table.date')}</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted text-xs">{t('table.net')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recent?.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-secondary">
                      <Receipt className="w-4 h-4 text-muted shrink-0" />
                      {tType(row.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.date))}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${row.amount < 0 ? 'text-error' : 'text-secondary'}`}>
                    {fmtAmount(row.amount)}
                  </td>
                </tr>
              ))}
              {(recent?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted">{t('noActivity')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
