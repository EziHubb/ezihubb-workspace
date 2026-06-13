'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, DollarSign, Wallet, Store, Clock, TrendingUp } from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { StatCard } from '../../../components/data/StatCard';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount, fmtDate, unwrapArr } from '../../../lib/fmt';
import { FilterSelect } from '../../../components/ui/FilterSelect';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinanceStats {
  totalFeesCollected:  number;
  feesThisMonth:       number;
  pendingPayoutAmount: number;
  pendingPayoutCount:  number;
  totalPaidOutAmount:  number;
  totalPaidOutCount:   number;
  activeStores:        number;
  feeGrowthPct:        number | null;
}

interface StoreRevRow {
  storeId:      string;
  storeName:    string;
  storeSlug:    string;
  totalRevenue: number;
  totalOrders:  number;
  feesCollected:number;
  lastOrderAt:  string | null;
}

interface StoreRevenueResponse {
  data:       StoreRevRow[];
  pagination: { total: number; page: number; totalPages: number };
}

interface RevenueByDay {
  date:    string;
  revenue: number;
  fees:    number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const QK_STATS = ['admin-finance-stats'];
const QK_STORES = (page: number, sort: string) => ['admin-finance-stores', page, sort];
const QK_CHART = (days: number) => ['admin-finance-chart', days];

// ── Mini bar chart ────────────────────────────────────────────────────────────

function MiniBarChart({ data, valueKey }: { data: RevenueByDay[]; valueKey: 'revenue' | 'fees' }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative"
          title={`${d.date}: ${fmtAmount(d[valueKey])}`}>
          <div
            className="w-full bg-primary/30 group-hover:bg-primary rounded-sm transition-colors"
            style={{ height: `${Math.max(4, (d[valueKey] / max) * 56)}px` }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminFinancePage() {
  const [storePage, setStorePage] = useState(1);
  const [storeSort, setStoreSort] = useState('revenue');
  const [chartDays,  setChartDays ] = useState(30);

  const { data: stats, isLoading: statsLoading } = useQuery<FinanceStats>({
    queryKey: ['admin-finance-stats'],
    queryFn:  () => api.get<FinanceStats>(API_ROUTES.ADMIN.FINANCE_STATS),
    staleTime: 60_000,
  });

  const { data: storesData, isLoading: storesLoading } = useQuery<StoreRevenueResponse>({
    queryKey: ['admin-finance-stores', storePage, storeSort],
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(storePage), limit: '15', sort: storeSort });
      return api.get<StoreRevenueResponse>(`${API_ROUTES.ADMIN.FINANCE_STORES}?${p}`);
    },
  });

  const { data: chartData, isLoading: chartLoading } = useQuery<RevenueByDay[]>({
    queryKey: ['admin-finance-chart', chartDays],
    queryFn:  () => api.get<RevenueByDay[]>(`${API_ROUTES.ADMIN.FINANCE_CHART}?days=${chartDays}`),
    staleTime: 120_000,
  });

  const stores     = unwrapArr<StoreRevRow>(storesData);
  const pagination = storesData?.pagination;
  const chart      = chartData ?? [];

  return (
    <div>
      <AdminPageHeader
        title="Finance"
        subtitle="Platform revenue and payout overview"
        queryKey={QK_STATS}
      />

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface border border-border rounded-card animate-pulse" />
          ))
        ) : (
          <>
            <StatCard label="Total Fees Collected" value={fmtAmount(stats?.totalFeesCollected ?? 0)} icon={DollarSign} color="green" />
            <StatCard label="Fees This Month" value={fmtAmount(stats?.feesThisMonth ?? 0)} icon={BarChart2} color="coral"
              trend={stats?.feeGrowthPct != null
                ? { direction: stats.feeGrowthPct >= 0 ? 'up' : 'down', percent: Math.abs(stats.feeGrowthPct) }
                : undefined}
            />
            <StatCard label="Pending Payout" value={fmtAmount(stats?.pendingPayoutAmount ?? 0)} icon={Clock} color="amber" />
            <StatCard label="Total Paid Out" value={fmtAmount(stats?.totalPaidOutAmount ?? 0)} icon={Wallet} color="blue" />
            <StatCard label="Active Stores" value={String(stats?.activeStores ?? 0)} icon={Store} color="coral" />
          </>
        )}
      </div>

      {/* ── Revenue chart ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-secondary">Revenue & Fees Trend</h3>
            <p className="text-xs text-muted mt-0.5">Gross merchandise value and platform fees</p>
          </div>
          <FilterSelect
            value={String(chartDays)}
            onChange={(v) => setChartDays(Number(v))}
            size="sm"
            options={[
              { value: '7',  label: 'Last 7 days' },
              { value: '14', label: 'Last 14 days' },
              { value: '30', label: 'Last 30 days' },
              { value: '90', label: 'Last 90 days' },
            ]}
          />
        </div>
        {chartLoading ? (
          <div className="h-24 bg-muted/10 rounded animate-pulse" />
        ) : chart.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-sm text-muted">No data for this period.</div>
        ) : (
          <div className="space-y-3">
            <MiniBarChart data={chart} valueKey="revenue" />
            <div className="flex items-end justify-between text-xs text-muted">
              <span>{chart[0]?.date ? fmtDate(chart[0].date) : ''}</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary/30" />
                  Revenue: {fmtAmount(chart.reduce((s, d) => s + d.revenue, 0))}
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  Fees: {fmtAmount(chart.reduce((s, d) => s + d.fees, 0))}
                </span>
              </div>
              <span>{chart[chart.length - 1]?.date ? fmtDate(chart[chart.length - 1].date) : ''}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Store breakdown ───────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-secondary text-sm">Revenue by Store</h3>
            {pagination && (
              <p className="text-xs text-muted mt-0.5">{pagination.total} stores</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FilterSelect
              value={storeSort}
              onChange={(v) => { setStoreSort(v); setStorePage(1); }}
              size="sm"
              options={[
                { value: 'revenue', label: 'Revenue ↓' },
                { value: 'orders',  label: 'Orders ↓' },
                { value: 'fees',    label: 'Fees ↓' },
              ]}
            />
          </div>
        </div>

        {storesLoading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted/10 rounded animate-pulse" />
            ))}
          </div>
        ) : stores.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">No store data available.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
            {/* Header */}
            <div className="grid grid-cols-5 gap-4 px-5 py-2.5 bg-background border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wide min-w-[480px]">
              <span className="col-span-2">Store</span>
              <span className="text-right">Revenue</span>
              <span className="text-right">Orders</span>
              <span className="text-right">Fees</span>
            </div>
            <div className="divide-y divide-border">
              {stores.map((s) => (
                <div key={s.storeId} className="grid grid-cols-5 gap-4 px-5 py-3 items-center hover:bg-background/50 transition-colors min-w-[480px]">
                  <div className="col-span-2 min-w-0">
                    <a href={`/stores/${s.storeId}`}
                      className="text-sm font-medium text-secondary hover:text-primary transition-colors truncate block">
                      {s.storeName}
                    </a>
                    <p className="text-xs text-muted font-mono">/shops/{s.storeSlug}</p>
                  </div>
                  <p className="text-sm font-semibold text-secondary tabular-nums text-right">{fmtAmount(s.totalRevenue)}</p>
                  <p className="text-sm text-muted tabular-nums text-right">{s.totalOrders}</p>
                  <p className="text-sm font-semibold text-green-700 tabular-nums text-right">{fmtAmount(s.feesCollected)}</p>
                </div>
              ))}
            </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <p className="text-xs text-muted">Page {storePage} of {pagination.totalPages}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStorePage((p) => Math.max(1, p - 1))} disabled={storePage <= 1}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
                    Previous
                  </button>
                  <button type="button" onClick={() => setStorePage((p) => p + 1)} disabled={storePage >= pagination.totalPages}
                    className="px-3 py-1 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary transition-colors">
                    Next
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
