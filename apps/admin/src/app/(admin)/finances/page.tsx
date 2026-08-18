'use client';

import Link from 'next/link';
import { Clock, CheckCircle2, AlertCircle, ArrowRight, Landmark, Receipt } from 'lucide-react';
import { useFinancesOverview, useFinancesActivitySummary, useFinancesActivities } from '../../../lib/useFinances';
import { fmtAmount } from '../../../lib/fmt';
import { ActivitySummaryCard } from '../../../components/finances/ActivitySummaryCard';
import { TooltipTerm } from '../../../components/finances/InfoTooltip';
import { LEDGER_TYPE_LABEL } from '../../../components/finances/ledgerTypeLabel';
import { ReloadButton } from '../../../components/ui/ReloadButton';

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

const SCHEDULE_LABEL: Record<string, string> = {
  WEEKLY: 'Weekly', BIWEEKLY: 'Every 2 weeks', MONTHLY: 'Monthly',
};

export default function PaymentAccountPage() {
  const { data: overview, isLoading: ovLoading } = useFinancesOverview();
  const { data: summary, isLoading: sumLoading } = useFinancesActivitySummary();
  const { data: recent } = useFinancesActivities(undefined, undefined, 1, 5);

  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-secondary">Payment account</h1>
        <ReloadButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-8">
        {/* Balance card */}
        <div className="bg-surface border border-border rounded-card p-6">
          {ovLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted mb-1">Current</p>
                  <p className={`font-display text-3xl font-bold ${(overview?.current ?? 0) < 0 ? 'text-error' : 'text-secondary'}`}>
                    {fmtAmount(overview?.current ?? 0)}
                  </p>
                  <p className="text-xs text-muted mt-1">Balance to be covered by future or pending earnings</p>
                </div>
                <div>
                  <p className="text-sm text-muted mb-1">Pending</p>
                  <p className="font-display text-3xl font-bold text-secondary">{fmtAmount(overview?.pending ?? 0)}</p>
                  <p className="text-xs text-muted mt-1">No funds pending</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-muted mb-1">Total</p>
                  <p className="text-xs text-muted">All sales, fees, refunds, and credits</p>
                </div>
                <p className={`font-display text-xl font-bold ${(overview?.total ?? 0) < 0 ? 'text-error' : 'text-secondary'}`}>
                  {fmtAmount(overview?.total ?? 0)}
                </p>
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border text-sm">
                <span className="text-muted">Funds are eligible for deposit 14 days after a sale.</span>
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
                <span className="text-sm font-bold text-secondary">Funds ready for deposit</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-secondary shrink-0" />
                <span className="text-sm font-bold text-secondary">No funds ready for deposit</span>
              </div>
            )}
            <p className="text-xs text-muted mb-3">
              Deposits become available once your current balance is above {fmtAmount(overview?.depositMinAmount ?? 2)}.
            </p>
            <Link
              href="/finances/payment-settings"
              className="flex items-center justify-between text-xs font-medium text-secondary hover:text-primary transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-muted" />
                Deposit settings
              </span>
              <span className="flex items-center gap-1 text-muted">
                {overview?.bankAccount
                  ? SCHEDULE_LABEL[overview.bankAccount.depositSchedule]
                  : 'Not set'}
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
                  ? `Nothing due for ${monthLabel}`
                  : `${fmtAmount(overview?.amountDueThisMonth ?? 0)} due for ${monthLabel}`}
              </span>
            </div>
            <p className="text-xs text-muted mb-3">
              {overview?.nothingDueThisMonth
                ? 'Your earnings covered your fees this month.'
                : 'This amount will be charged to your billing card.'}
            </p>
            <Link
              href="/finances/payment-settings?tab=billing"
              className="flex items-center justify-between text-xs font-medium text-secondary hover:text-primary transition-colors"
            >
              <span>Auto-billing</span>
              <span className="flex items-center gap-1 text-muted">
                {overview?.defaultCard
                  ? `•••• ${overview.defaultCard.last4}`
                  : 'Not set'}
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
          <h2 className="text-base font-bold text-secondary">Recent activities</h2>
          <Link
            href="/finances/statements"
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            See full history <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-sm text-secondary mb-4">
          Your{' '}
          <TooltipTerm tooltip="A running total of all activity in your Payment account, like money you've made from your sales, fees you've been charged, and more. This number changes with each new transaction. Your total balance might include funds from recent sales that aren't available for deposit yet.">
            total balance
          </TooltipTerm>{' '}
          is{' '}
          <span className={(overview?.current ?? 0) < 0 ? 'text-error font-bold' : 'text-secondary font-bold'}>
            {fmtAmount(overview?.current ?? 0)}
          </span>
        </p>

        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted text-xs">Description</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted text-xs">Net</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted text-xs">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recent?.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-muted whitespace-nowrap">
                    {new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(row.date))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-secondary">
                      <Receipt className="w-4 h-4 text-muted shrink-0" />
                      {LEDGER_TYPE_LABEL[row.type] ?? row.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-secondary max-w-xs truncate">{row.description}</td>
                  <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${row.amount < 0 ? 'text-error' : 'text-secondary'}`}>
                    {fmtAmount(row.amount)}
                  </td>
                  <td className={`px-4 py-3 text-right whitespace-nowrap ${row.balance < 0 ? 'text-error' : 'text-secondary'}`}>
                    {fmtAmount(row.balance)}
                  </td>
                </tr>
              ))}
              {(recent?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">No activity yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-center mt-4">
          <Link
            href="/finances/statements"
            className="px-4 py-2 border border-border text-secondary text-sm font-semibold rounded-pill hover:bg-muted/8 transition-colors"
          >
            View all monthly statements
          </Link>
        </div>
      </div>
    </div>
  );
}
