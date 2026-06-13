'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Users, DollarSign, Clock } from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtDate, fmtNum, fmtAmount, capitalize } from '../../../lib/fmt';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReferralOverview {
  kpis: {
    totalReferrers:       number;
    monthlyActive:        number;
    totalPaidOut:         number;
    pendingCommissions:   { count: number; amount: number };
    confirmedCommissions: { count: number; amount: number };
  };
  topReferrers: TopReferrer[];
  recentCommissions: RecentCommission[];
}

interface TopReferrer {
  id:             string;
  name:           string;
  email:          string;
  referralCode:   string;
  totalReferrals: number;
  earned:         number;
  balance:        number;
  tier: {
    name:       string;
    badgeColor: string;
    badgeIcon:  string;
  } | null;
}

interface RecentCommission {
  id:          string;
  createdAt:   string;
  earner:      string;
  buyer:       string;
  orderNumber: string;
  level:       number;
  amount:      number;
  status:      string;
}

// ── Status badge ───────────────────────────────────────────────────────────────

const COMMISSION_STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function CommissionStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${COMMISSION_STATUS_COLORS[status] ?? 'bg-muted/10 text-muted'}`}>
      {capitalize(status)}
    </span>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon:  React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-secondary mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReferralsOverviewPage() {
  const { data, isLoading } = useQuery<ReferralOverview>({
    queryKey: ['admin-referrals-overview'],
    queryFn:  () => api.get<ReferralOverview>(API_ROUTES.ADMIN.ADMIN_CREATORS_OVERVIEW),
    staleTime: 60_000,
  });

  const kpis = data?.kpis;

  return (
    <>
      <AdminPageHeader
        title="Referrals"
        subtitle="Overview of the multi-level referral programme"
        queryKey={['admin-referrals-overview']}
      />

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[76px] bg-surface border border-border rounded-card animate-pulse" />
            ))
          : (
            <>
              <KpiCard
                label="Total Referring Users"
                value={fmtNum(kpis?.totalReferrers)}
                icon={Users}
                color="bg-blue-500"
              />
              <KpiCard
                label="Active This Month"
                value={fmtNum(kpis?.monthlyActive)}
                icon={TrendingUp}
                color="bg-green-500"
              />
              <KpiCard
                label="Total Paid Out"
                value={`$${fmtAmount(kpis?.totalPaidOut)}`}
                icon={DollarSign}
                color="bg-primary"
              />
              <KpiCard
                label="Pending Amount"
                value={`$${fmtAmount(kpis?.pendingCommissions?.amount)}`}
                icon={Clock}
                color="bg-amber-500"
              />
            </>
          )
        }
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Top Referrers ── */}
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-semibold text-secondary text-sm">Top Referrers</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['Rank', 'User', 'Tier', 'Refs', 'Earned', 'Balance'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  : (data?.topReferrers ?? []).length === 0
                    ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No referrers yet.</td>
                        </tr>
                      )
                    : (data?.topReferrers ?? []).map((r, i) => (
                        <tr key={r.id} className="hover:bg-muted/3 transition-colors">
                          <td className="px-4 py-3 font-bold text-secondary tabular-nums w-10">
                            #{i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-secondary text-xs">{r.name || '—'}</p>
                            <p className="text-xs text-muted font-mono mt-0.5">{r.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            {r.tier
                              ? (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                    style={{ background: r.tier.badgeColor }}
                                  >
                                    {r.tier.name}
                                  </span>
                                )
                              : <span className="text-xs text-muted">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-secondary tabular-nums text-xs">{r.totalReferrals}</td>
                          <td className="px-4 py-3 font-semibold text-secondary tabular-nums text-xs">${fmtAmount(r.earned)}</td>
                          <td className="px-4 py-3 font-semibold text-secondary tabular-nums text-xs">${fmtAmount(r.balance)}</td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent Commissions ── */}
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="font-semibold text-secondary text-sm">Recent Commissions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['Date', 'Earner', 'Buyer', 'Lvl', 'Amount', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-muted/10 rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  : (data?.recentCommissions ?? []).length === 0
                    ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">No commissions yet.</td>
                        </tr>
                      )
                    : (data?.recentCommissions ?? []).map((c) => (
                        <tr key={c.id} className="hover:bg-muted/3 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                            {fmtDate(c.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-secondary truncate max-w-[120px]">
                              {c.earner || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-muted truncate max-w-[120px]">
                              {c.buyer || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                              {c.level}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-secondary tabular-nums text-xs">${fmtAmount(c.amount)}</td>
                          <td className="px-4 py-3">
                            <CommissionStatusBadge status={c.status} />
                          </td>
                        </tr>
                      ))
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
