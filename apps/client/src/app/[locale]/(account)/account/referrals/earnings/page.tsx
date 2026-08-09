'use client';

import { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { Skeleton } from '@ezihubb/ui';
import { useAuthQuery } from '../../../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, safeArr } from '@ezihubb/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type CommissionStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';

interface ReferralCommission {
  id:        string;
  amount:    number;
  status:    CommissionStatus;
  level:     number;
  orderId:   string | null;
  fromUser?: { firstName: string; lastName: string };
  createdAt: string;
  lockedAt:  string | null;
}

interface CommissionsPage {
  data:        ReferralCommission[];
  total:       number;
  page:        number;
  limit:       number;
  totalPages:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
function formatDate(d: string) { return fmt.format(new Date(d)); }

function daysUntilLock(lockedAt: string | null): number | null {
  if (!lockedAt) return null;
  const diff = new Date(lockedAt).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : null;
}

const STATUS_BADGE: Record<CommissionStatus, { label: string; className: string }> = {
  PENDING:   { label: 'Pending',   className: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  PAID:      { label: 'Paid',      className: 'bg-gray-100 text-gray-500' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-600' },
};

const LEVEL_LABEL: Record<number, string> = {
  1: 'Direct (L1)',
  2: 'Level 2',
  3: 'Level 3',
};

type FilterTab = 'ALL' | CommissionStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'ALL',       label: 'All'       },
  { key: 'PENDING',   label: 'Pending'   },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'PAID',      label: 'Paid'      },
];

const PAGE_SIZE = 20;

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="border border-border rounded-card overflow-hidden">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-4 items-center px-5 py-4 border-b border-border last:border-0"
        >
          <Skeleton variant="text" className="w-24" />
          <Skeleton variant="text" className="w-32" />
          <Skeleton variant="text" className="w-20" />
          <Skeleton variant="text" className="w-12" />
          <Skeleton variant="text" className="w-16" />
          <Skeleton variant="text" className="w-16" />
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReferralEarningsPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [page, setPage]           = useState(1);

  const params: Record<string, unknown> = { page, limit: PAGE_SIZE };
  if (activeTab !== 'ALL') params['status'] = activeTab;

  const { data, isLoading } = useAuthQuery<CommissionsPage>(
    ['referrals', 'me', 'commissions', activeTab, page],
    API_ROUTES.REFERRALS.ME_COMMISSIONS,
    params,
  );

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="font-display text-2xl font-bold text-secondary">Commission History</h1>
        <p className="text-sm text-muted mt-1">
          All referral commissions earned across your network.
        </p>
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-[#FAFAF8] border border-border rounded-card w-fit">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleTabChange(key)}
            className={[
              'px-4 py-1.5 rounded-button text-sm font-medium transition-colors',
              activeTab === key
                ? 'bg-white shadow-sm text-secondary border border-border'
                : 'text-muted hover:text-secondary',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {isLoading && <TableSkeleton />}

      {!isLoading && data && (
        safeArr(data.data).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <DollarSign className="w-10 h-10 text-muted/30" />
            <p className="text-sm text-muted">
              {activeTab === 'ALL'
                ? 'No commissions yet. Share your referral link to start earning!'
                : `No ${activeTab.toLowerCase()} commissions.`}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block border border-border rounded-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#FAFAF8] border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">From</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Order</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Level</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Amount</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-muted uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {safeArr(data.data).map((c) => {
                    const lockDays   = c.status === 'PENDING' ? daysUntilLock(c.lockedAt) : null;
                    const badge      = STATUS_BADGE[c.status];
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border last:border-0 hover:bg-surface transition-colors"
                      >
                        <td className="px-5 py-4 text-secondary">
                          {formatDate(c.createdAt)}
                        </td>
                        <td className="px-5 py-4 text-secondary">
                          {c.fromUser
                            ? `${c.fromUser.firstName} ${c.fromUser.lastName}`
                            : <span className="text-muted italic">—</span>}
                        </td>
                        <td className="px-5 py-4 text-secondary font-mono text-xs">
                          {c.orderId
                            ? `#${c.orderId.slice(-8).toUpperCase()}`
                            : <span className="text-muted italic">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                            {LEVEL_LABEL[c.level] ?? `Level ${c.level}`}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right font-bold tabular-nums text-green-700">
                          +{fmtAmount(c.amount)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                              {badge.label}
                            </span>
                            {lockDays !== null && (
                              <span className="text-[10px] text-amber-600">
                                Locks in {lockDays}d
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden border border-border rounded-card overflow-hidden divide-y divide-border">
              {safeArr(data.data).map((c) => {
                const lockDays = c.status === 'PENDING' ? daysUntilLock(c.lockedAt) : null;
                const badge    = STATUS_BADGE[c.status];
                return (
                  <div key={c.id} className="px-4 py-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-secondary">
                          {c.fromUser
                            ? `${c.fromUser.firstName} ${c.fromUser.lastName}`
                            : `${LEVEL_LABEL[c.level] ?? `Level ${c.level}`} commission`}
                        </p>
                        <p className="text-xs text-muted">{formatDate(c.createdAt)}</p>
                      </div>
                      <span className="text-base font-bold tabular-nums text-green-700 shrink-0">
                        +{fmtAmount(c.amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                        {LEVEL_LABEL[c.level] ?? `Level ${c.level}`}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                      {lockDays !== null && (
                        <span className="text-[10px] text-amber-600 font-medium">
                          Locks in {lockDays}d
                        </span>
                      )}
                      {c.orderId && (
                        <span className="text-[10px] text-muted font-mono">
                          #{c.orderId.slice(-8).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Pagination ───────────────────────────────────────────────── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted text-xs">
                  Page {page} of {totalPages} &nbsp;·&nbsp; {data.total} total
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 border border-border rounded-button text-xs font-medium text-secondary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
  );
}
