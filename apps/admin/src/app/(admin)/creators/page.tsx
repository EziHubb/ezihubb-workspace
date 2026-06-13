'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  TrendingUp, Users, DollarSign, Clock, X, GitBranch, Settings,
} from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { API_ROUTES, ADMIN_ROUTES } from '@mlh/constants';
import { fmtAmount } from '../../../lib/fmt';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CreatorOverview {
  kpis: {
    totalReferringUsers:  number;
    activeThisMonth:      number;
    totalPaidOut:         number;
    pendingAmount:        number;
    confirmedAmount:      number;
  };
  pipeline: {
    pending:   number;
    confirmed: number;
    paid:      number;
  };
  topReferrers:      TopCreator[];
  recentCommissions: RecentEarning[];
}

interface TopCreator {
  rank:        number;
  userId:      string;
  email:       string;
  firstName:   string | null;
  lastName:    string | null;
  referralCode:string | null;
  tierName:    string | null;
  tierColor:   string | null;
  directRefs:  number;
  networkSize: number;
  earned:      number;
  balance:     number;
}

interface RecentEarning {
  id:          string;
  createdAt:   string;
  earnerEmail: string;
  earnerName:  string | null;
  buyerEmail:  string | null;
  buyerName:   string | null;
  level:       number;
  amount:      number;
  status:      string;
}

interface CreatorPayoutRow {
  id:            string;
  amount:        number;
  paymentMethod: string;
  paymentDetail: string;
  status:        string;
  createdAt:     string;
  user: { email: string; firstName: string | null; lastName: string | null };
}

interface PayoutsResponse {
  data:       CreatorPayoutRow[];
  total:      number;
  totalPages: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RANK_BADGES: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const EARNING_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const PAYOUT_STATUS_COLORS: Record<string, string> = {
  REQUESTED:  'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID:       'bg-green-100 text-green-700',
  REJECTED:   'bg-red-100 text-red-700',
};

// ── Creator detail drawer ─────────────────────────────────────────────────────

function CreatorDrawer({ creator, onClose }: { creator: TopCreator; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md h-full shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-secondary">Creator Profile</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-secondary p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ background: creator.tierColor ?? '#6B7280' }}>
              {(creator.firstName?.[0] ?? creator.email[0]).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-secondary">
                {[creator.firstName, creator.lastName].filter(Boolean).join(' ') || '—'}
              </p>
              <p className="text-xs text-muted font-mono">{creator.email}</p>
              {creator.tierName && (
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ background: creator.tierColor ?? '#6B7280' }}>
                  {creator.tierName}
                </span>
              )}
            </div>
          </div>

          {/* Creator code */}
          {creator.referralCode && (
            <div className="bg-[#FAFAF8] border border-border rounded-card p-4">
              <p className="text-xs text-muted mb-1">Creator code</p>
              <p className="font-mono font-bold text-secondary">{creator.referralCode}</p>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Direct members',  value: String(creator.directRefs)            },
              { label: 'Network size',    value: String(creator.networkSize ?? 0)       },
              { label: 'Total earned',    value: fmtAmount(creator.earned)              },
              { label: 'Available',       value: fmtAmount(creator.balance)             },
            ].map(({ label, value }) => (
              <div key={label} className="border border-border rounded-card p-3">
                <p className="text-xs text-muted">{label}</p>
                <p className="font-bold text-secondary mt-0.5 tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            <a href={`${ADMIN_ROUTES.CREATORS_ADMIN_MEMBERS}?search=${encodeURIComponent(creator.email)}`}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <GitBranch className="w-4 h-4" /> View full referral tree
            </a>
            <a href={`${ADMIN_ROUTES.CREATORS_ADMIN_PAYOUTS}?creatorId=${creator.userId}`}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <DollarSign className="w-4 h-4" /> View payout history
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CreatorNetworkOverviewPage() {
  const [selectedCreator, setSelectedCreator] = useState<TopCreator | null>(null);
  const [payoutsPage, setPayoutsPage]         = useState(1);

  const { data, isLoading } = useQuery<CreatorOverview>({
    queryKey:  ['admin-creators-overview'],
    queryFn:   () => api.get<CreatorOverview>(API_ROUTES.ADMIN.ADMIN_CREATORS_OVERVIEW),
    staleTime: 60_000,
  });

  const { data: payouts, isLoading: payoutsLoading } = useQuery<PayoutsResponse>({
    queryKey: ['admin-creators-payouts', payoutsPage],
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(payoutsPage), limit: '10', status: 'REQUESTED' });
      return api.get<PayoutsResponse>(`${API_ROUTES.ADMIN.ADMIN_CREATORS_PAYOUTS}?${p}`);
    },
    staleTime: 30_000,
  });

  const kpis    = data?.kpis;
  const pipeline = data?.pipeline;

  return (
    <>
      <AdminPageHeader
        title="Creator Network"
        subtitle="Manage creators, commissions, and payouts"
        queryKey={['admin-creators-overview']}
        actions={
          <a href={ADMIN_ROUTES.CREATORS_ADMIN_SETTINGS}
            className="flex items-center gap-2 text-sm font-medium border border-border rounded-button px-3 py-2 text-secondary hover:border-primary transition-colors">
            <Settings className="w-4 h-4" /> Settings
          </a>
        }
      />

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Users,      label: 'Total Creators',    value: String((kpis?.totalReferringUsers ?? 0).toLocaleString()), sub: 'registered',      color: 'bg-blue-500'  },
          { icon: TrendingUp, label: 'Active This Month', value: String((kpis?.activeThisMonth    ?? 0).toLocaleString()), sub: 'earned or referred',color: 'bg-green-500' },
          { icon: DollarSign, label: 'Total Paid Out',    value: fmtAmount(kpis?.totalPaidOut     ?? 0),                   sub: 'all time',          color: 'bg-primary'   },
          { icon: Clock,      label: 'Pending Earnings',  value: fmtAmount(kpis?.pendingAmount    ?? 0),                   sub: 'unlocking soon',    color: 'bg-amber-500' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          isLoading
            ? <div key={label} className="h-20 bg-surface border border-border rounded-card animate-pulse" />
            : (
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
            )
        ))}
      </div>

      {/* ── Commission pipeline ───────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card p-5 mb-8">
        <h3 className="font-semibold text-secondary text-sm mb-4">Commission Pipeline</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Pending',   value: fmtAmount(pipeline?.pending   ?? 0), sub: 'locked, await delivery', color: 'bg-amber-500' },
            { label: 'Confirmed', value: fmtAmount(pipeline?.confirmed ?? 0), sub: 'ready for payout',        color: 'bg-green-500' },
            { label: 'Paid',      value: fmtAmount(pipeline?.paid      ?? 0), sub: 'all-time paid out',       color: 'bg-gray-400'  },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-2 h-10 rounded-full shrink-0 ${color}`} />
              <div>
                <p className="text-xs text-muted">{label}</p>
                <p className="font-bold text-secondary tabular-nums">{value}</p>
                <p className="text-xs text-muted">{sub}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Bar visual */}
        {pipeline && (pipeline.pending + pipeline.confirmed + pipeline.paid) > 0 && (
          <div className="mt-4 h-2 rounded-full overflow-hidden flex gap-0.5">
            {(() => {
              const total = pipeline.pending + pipeline.confirmed + pipeline.paid;
              return [
                { pct: (pipeline.pending   / total) * 100, bg: 'bg-amber-400' },
                { pct: (pipeline.confirmed / total) * 100, bg: 'bg-green-400' },
                { pct: (pipeline.paid      / total) * 100, bg: 'bg-gray-300'  },
              ].map(({ pct, bg }, i) => (
                <div key={i} className={`h-full ${bg} transition-all`} style={{ width: `${pct}%` }} />
              ));
            })()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">

        {/* ── Top Creators ──────────────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-secondary text-sm">Top Creators This Month</h3>
            <a href={ADMIN_ROUTES.CREATORS_ADMIN_MEMBERS} className="text-xs text-primary hover:underline">View all →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['#', 'Creator', 'Tier', 'Members', 'Earned', 'Balance', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                      ))}</tr>
                    ))
                  : (data?.topReferrers ?? []).length === 0
                    ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">No creators yet.</td></tr>
                    : (data?.topReferrers ?? []).map((r) => (
                        <tr key={r.userId}
                          className="hover:bg-muted/3 transition-colors cursor-pointer"
                          onClick={() => setSelectedCreator(r)}>
                          <td className="px-4 py-3 font-bold text-secondary tabular-nums w-10">
                            {RANK_BADGES[r.rank] ?? `#${r.rank}`}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-secondary text-xs">{[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</p>
                            <p className="text-xs text-muted font-mono mt-0.5 truncate max-w-[120px]">{r.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            {r.tierName
                              ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white whitespace-nowrap" style={{ background: r.tierColor ?? '#6B7280' }}>{r.tierName}</span>
                              : <span className="text-xs text-muted">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs tabular-nums text-secondary">{r.directRefs}</td>
                          <td className="px-4 py-3 font-semibold text-secondary tabular-nums text-xs">{fmtAmount(r.earned)}</td>
                          <td className="px-4 py-3 font-semibold text-secondary tabular-nums text-xs">{fmtAmount(r.balance)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-primary hover:underline">View</span>
                          </td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent Earnings ───────────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-semibold text-secondary text-sm">Recent Earnings</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['Date', 'Creator', 'Buyer', 'Type', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                      ))}</tr>
                    ))
                  : (data?.recentCommissions ?? []).length === 0
                    ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No earnings yet.</td></tr>
                    : (data?.recentCommissions ?? []).map((c) => (
                        <tr key={c.id} className="hover:bg-muted/3 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{format(new Date(c.createdAt), 'MMM d')}</td>
                          <td className="px-4 py-3"><p className="text-xs font-medium text-secondary truncate max-w-[100px]">{c.earnerName || c.earnerEmail}</p></td>
                          <td className="px-4 py-3"><p className="text-xs text-muted truncate max-w-[100px]">{c.buyerName || c.buyerEmail || '—'}</p></td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.level === 1 ? 'bg-primary/10 text-primary' : 'bg-[#7C3AED]/10 text-[#7C3AED]'}`}>
                              {c.level === 1 ? 'Direct' : 'Network'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-secondary tabular-nums text-xs">{fmtAmount(c.amount)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${EARNING_STATUS_COLORS[c.status] ?? 'bg-muted/10 text-muted'}`}>
                              {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                            </span>
                          </td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Payout queue ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden mb-8">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-secondary text-sm">Payout Requests</h3>
          <a href={ADMIN_ROUTES.CREATORS_ADMIN_PAYOUTS} className="text-xs text-primary hover:underline">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                {['Creator', 'Amount', 'Method', 'Details', 'Requested', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payoutsLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                : (payouts?.data ?? []).length === 0
                  ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No pending payout requests.</td></tr>
                  : (payouts?.data ?? []).map((p) => (
                      <tr key={p.id} className="hover:bg-muted/3 transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-secondary">{[p.user.firstName, p.user.lastName].filter(Boolean).join(' ') || '—'}</p>
                          <p className="text-xs text-muted font-mono">{p.user.email}</p>
                        </td>
                        <td className="px-4 py-3 font-bold text-secondary tabular-nums text-xs">{fmtAmount(p.amount)}</td>
                        <td className="px-4 py-3 text-xs text-secondary capitalize">{p.paymentMethod.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-3 text-xs text-muted font-mono truncate max-w-[140px]">{p.paymentDetail}</td>
                        <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">{format(new Date(p.createdAt), 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PAYOUT_STATUS_COLORS[p.status] ?? 'bg-muted/10 text-muted'}`}>
                            {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
        {(payouts?.totalPages ?? 0) > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted">{payouts?.total ?? 0} total requests</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPayoutsPage((p) => Math.max(1, p - 1))} disabled={payoutsPage <= 1}
                className="px-3 py-1 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors">
                Previous
              </button>
              <button type="button" onClick={() => setPayoutsPage((p) => p + 1)} disabled={payoutsPage >= (payouts?.totalPages ?? 1)}
                className="px-3 py-1 text-xs font-medium border border-border rounded-button text-secondary hover:border-primary/40 disabled:opacity-40 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Commission rates ─────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-secondary text-sm">Commission Rates</h3>
          <a href={ADMIN_ROUTES.CREATORS_ADMIN_SETTINGS} className="text-xs text-primary hover:underline">Edit rates →</a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { level: 'Level 1', desc: 'Direct referral',      rate: '10%', color: 'bg-primary'   },
            { level: 'Level 2', desc: 'Community (2nd level)', rate: '5%',  color: 'bg-[#7C3AED]' },
            { level: 'Level 3', desc: 'Community (3rd level)', rate: '1%',  color: 'bg-blue-500'  },
          ].map(({ level, desc, rate, color }) => (
            <div key={level} className="flex items-center gap-3 border border-border rounded-card p-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0 ${color}`}>
                {rate}
              </div>
              <div>
                <p className="font-semibold text-secondary text-xs">{level}</p>
                <p className="text-xs text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Creator drawer ────────────────────────────────────────────────── */}
      {selectedCreator && (
        <CreatorDrawer
          creator={selectedCreator}
          onClose={() => setSelectedCreator(null)}
        />
      )}
    </>
  );
}
