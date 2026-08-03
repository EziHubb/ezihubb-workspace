'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, FlaskConical, StopCircle, RotateCcw, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { StatCard } from '../../../../components/data/StatCard';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtDate, fmtPercentRaw, safeArr } from '../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricingStats {
  activeTests:         number;
  completedTests:      number;
  avgRevenueUplift:    number | null;
  avgConversionUplift: number | null;
  totalProductsTested: number;
}

interface PricingTest {
  id:              string;
  productId:       string;
  productTitle:    string;
  controlPrice:    number;
  variantPrice:    number;
  status:          'ACTIVE' | 'COMPLETED' | 'REVERTED';
  startedAt:       string;
  endedAt:         string | null;
  controlRevenue:  number | null;
  variantRevenue:  number | null;
  conversionLift:  number | null;
  revenueLift:     number | null;
}

interface PricingTestsResponse {
  data:       PricingTest[];
  pagination: { total: number; page: number; totalPages: number };
}

// ── Lift cell ─────────────────────────────────────────────────────────────────

function LiftCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted text-sm">—</span>;
  const up = value >= 0;
  return (
    <span className={`flex items-center gap-1 text-sm font-semibold ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
      {up ? '+' : ''}{fmtPercentRaw(value)}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PricingTest['status'] }) {
  const cfg = {
    ACTIVE:    'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    REVERTED:  'bg-gray-100 text-gray-600',
  }[status];
  const label = { ACTIVE: 'Active', COMPLETED: 'Completed', REVERTED: 'Reverted' }[status];
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg}`}>{label}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const QK_STATS = ['ai-pricing-stats'];
const QK_TESTS = (page: number, status: string) => ['ai-pricing-tests', page, status];

export default function AiPricingPage() {
  const [page,   setPage]   = useState(1);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'REVERTED'>('ALL');
  const qc = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<PricingStats>({
    queryKey: QK_STATS,
    queryFn:  () => api.get<PricingStats>(API_ROUTES.ADMIN.AI_PRICING_STATS),
    staleTime: 60_000,
  });

  const { data: testsData, isLoading: testsLoading } = useQuery<PricingTestsResponse>({
    queryKey: QK_TESTS(page, filter),
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (filter !== 'ALL') p.set('status', filter);
      return api.get<PricingTestsResponse>(`${API_ROUTES.ADMIN.AI_PRICING_TESTS}?${p}`);
    },
    staleTime: 30_000,
  });

  const [actionId, setActionId] = useState<string | null>(null);

  const endTest = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_PRICING_TEST_END(id), {}),
    onMutate:   (id) => setActionId(id),
    onSettled:  () => { setActionId(null); qc.invalidateQueries({ queryKey: ['ai-pricing'] }); },
  });

  const revertTest = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.AI_PRICING_TEST_REVERT(id), {}),
    onMutate:   (id) => setActionId(id),
    onSettled:  () => { setActionId(null); qc.invalidateQueries({ queryKey: ['ai-pricing'] }); },
  });

  const tests      = safeArr(testsData?.data);
  const pagination = testsData?.pagination;

  return (
    <div>
      <AdminPageHeader
        title="Pricing Optimizer"
        subtitle="AI-driven A/B price tests across your product catalog"
        queryKey={QK_STATS}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-border rounded-card animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Active Tests"          value={String(stats?.activeTests ?? 0)}                                     icon={FlaskConical} color="blue"  />
            <StatCard label="Completed Tests"        value={String(stats?.completedTests ?? 0)}                                   icon={DollarSign}   color="green" />
            <StatCard label="Products Tested"        value={String(stats?.totalProductsTested ?? 0)}                              icon={DollarSign}   color="coral" />
            <StatCard label="Avg Revenue Lift"       value={stats?.avgRevenueUplift    != null ? fmtPercentRaw(stats.avgRevenueUplift)    : '—'} icon={TrendingUp}  color="green" />
            <StatCard label="Avg Conversion Lift"    value={stats?.avgConversionUplift != null ? fmtPercentRaw(stats.avgConversionUplift) : '—'} icon={TrendingUp}  color="blue"  />
          </>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(['ALL', 'ACTIVE', 'COMPLETED', 'REVERTED'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setFilter(s); setPage(1); }}
            className={[
              'px-3 py-1.5 text-sm rounded-button border transition-colors',
              filter === s ? 'bg-primary text-white border-primary' : 'border-border text-muted hover:border-primary hover:text-secondary',
            ].join(' ')}
          >
            {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
        {pagination && <span className="ml-auto text-xs text-muted">{pagination.total} tests</span>}
      </div>

      {/* Tests table */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {testsLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted" /></div>
        ) : tests.length === 0 ? (
          <div className="p-12 text-center">
            <FlaskConical className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <p className="text-sm text-muted">No pricing tests found.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  {['Product', 'Control', 'Variant', 'Revenue Lift', 'Conv. Lift', 'Status', 'Started', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tests.map((t) => (
                  <tr key={t.id} className="hover:bg-background transition-colors">
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="text-sm font-medium text-secondary truncate">{t.productTitle}</p>
                      <p className="text-xs text-muted font-mono">{t.productId.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 text-sm tabular-nums">{fmtAmount(t.controlPrice)}</td>
                    <td className="px-4 py-3 text-sm tabular-nums font-semibold text-primary">{fmtAmount(t.variantPrice)}</td>
                    <td className="px-4 py-3"><LiftCell value={t.revenueLift} /></td>
                    <td className="px-4 py-3"><LiftCell value={t.conversionLift} /></td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtDate(t.startedAt)}</td>
                    <td className="px-4 py-3">
                      {t.status === 'ACTIVE' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => endTest.mutate(t.id)}
                            disabled={endTest.isPending && actionId === t.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-button hover:bg-green-100 disabled:opacity-40 transition-colors"
                          >
                            {endTest.isPending && actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <StopCircle className="w-3 h-3" />}
                            End
                          </button>
                          <button
                            type="button"
                            onClick={() => revertTest.mutate(t.id)}
                            disabled={revertTest.isPending && actionId === t.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-button hover:bg-red-100 disabled:opacity-40 transition-colors"
                          >
                            {revertTest.isPending && actionId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            Revert
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-muted">Page {page} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">Previous</button>
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
