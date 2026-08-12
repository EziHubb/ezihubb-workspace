'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, ShoppingBag, PercentIcon, DollarSign,
  Heart, UserPlus, Star, ArrowRight, Search,
} from 'lucide-react';
import Link from 'next/link';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { API_ROUTES, ADMIN_ROUTES } from '@ezihubb/constants';
import { fmtCurrency, fmtNum, fmtPercentRaw, fmtRating, safeNum } from '../../../lib/fmt';
import { useAdminMode } from '../../../lib/store-context';
import { StorePicker, type StoreOption } from '../../../components/ui/StorePicker';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverviewData {
  visits:         number;
  orders:         number;
  conversionRate: number;
  revenue:        number;
  visitsDelta:    number;
  ordersDelta:    number;
  revenueDelta:   number;
  series: Array<{ date: string; visits: number; orders: number; revenue: number }>;
}

interface ShopperStatsData {
  itemFavourites:  number;
  shopFollows:     number;
  reviewCount:     number;
  avgRating:       number;
  favouritesDelta: number;
  followsDelta:    number;
  reviewsDelta:    number;
}

interface FunnelStep {
  stage:      string;
  count:      number;
  percentage: number;
}

interface SearchTerm {
  term:  string;
  count: number;
}

interface ListingRow {
  productId:   string;
  title:       string;
  imageUrl:    string | null;
  views:       number;
  favourites:  number;
  orders:      number;
  revenue:     number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: 'Yesterday',   value: '1d'  },
  { label: 'Last 7 days', value: '7d'  },
  { label: 'Last 30 days',value: '30d' },
  { label: 'Last 90 days',value: '90d' },
];

function delta(n: number) {
  if (n === 0) return <span className="text-muted text-xs">—</span>;
  const positive = n > 0;
  return (
    <span className={`text-xs font-medium ${positive ? 'text-green-600' : 'text-red-600'}`}>
      {positive ? '+' : ''}{n.toFixed(1)}%
    </span>
  );
}

// ── Sparkline (pure CSS bar chart) ───────────────────────────────────────────

function MiniChart({
  series,
  metric,
}: {
  series: OverviewData['series'];
  metric: 'visits' | 'orders' | 'revenue';
}) {
  const vals = series.map((s) => s[metric]);
  const max  = Math.max(...vals, 1);
  return (
    <div className="flex items-end gap-0.5 h-14 w-full">
      {vals.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-primary/20 rounded-sm hover:bg-primary/40 transition-colors"
          style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
          title={String(v)}
        />
      ))}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  delta: d,
  color = 'text-primary',
}: {
  icon:   React.ElementType;
  label:  string;
  value:  string;
  delta?: number;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-secondary">{value}</p>
      {d !== undefined && <div className="mt-1">{delta(d)}</div>}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const router = useRouter();
  const [range, setRange] = useState('7d');
  const { isPlatformContext } = useAdminMode();
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);

  // A platform-context Super Admin may drill into any single store's stats via
  // the picker below; everyone else (plain ADMIN, or Super Admin in "My Store"
  // mode) stays scoped to their own store exactly as before — omitting storeId
  // entirely is what keeps that ambient behavior unchanged.
  const explicitStoreId = isPlatformContext && selectedStore ? selectedStore.id : undefined;
  const qsStore = explicitStoreId ? `&storeId=${explicitStoreId}` : '';

  const { data: overview, isLoading: ovLoading } = useQuery<OverviewData>({
    queryKey: ['stats-overview', range, explicitStoreId],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.STATS_OVERVIEW}?range=${range}${qsStore}`),
  });

  const { data: shopper, isLoading: shLoading } = useQuery<ShopperStatsData>({
    queryKey: ['stats-shopper', range, explicitStoreId],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.STATS_SHOPPER}?range=${range}${qsStore}`),
  });

  const { data: funnel, isLoading: srcLoading } = useQuery<FunnelStep[]>({
    queryKey: ['stats-conversion-funnel', range, explicitStoreId],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.STATS_TRAFFIC_SOURCES}?range=${range}${qsStore}`),
  });

  const { data: listingsData } = useQuery<{ data: ListingRow[] }>({
    queryKey: ['stats-listings-preview', explicitStoreId],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.STATS_LISTINGS}?limit=5&sort=views${qsStore}`),
  });

  // Search terms are platform-wide only — meaningless scoped to one store —
  // so this stays keyed off isPlatformContext, not whether a store is picked.
  const { data: searchTerms } = useQuery<SearchTerm[]>({
    queryKey: ['stats-search-terms'],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.STATS_SEARCH_TERMS}?limit=8`),
    enabled:  isPlatformContext,
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Shop Traffic"
        subtitle="See how shoppers are finding and interacting with your shop."
      />

      {/* ── Platform-context store drilldown ───────────────────────────────── */}
      {isPlatformContext && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-card px-4 py-3">
          <span className="text-sm font-medium text-secondary shrink-0">Viewing:</span>
          <StorePicker value={selectedStore} onChange={setSelectedStore} className="max-w-xs" />
          <span className="text-xs text-muted">
            {selectedStore ? `Stats for ${selectedStore.name}` : 'Platform-wide aggregate — pick a store to drill in'}
          </span>
        </div>
      )}

      {/* ── Date range selector ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={[
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              range === opt.value
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-muted border-border hover:border-primary/40 hover:text-secondary',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {ovLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              icon={TrendingUp}
              label="Visits"
              value={fmtNum(overview?.visits)}
              delta={overview?.visitsDelta}
              color="text-blue-500"
            />
            <KpiCard
              icon={ShoppingBag}
              label="Orders"
              value={fmtNum(overview?.orders)}
              delta={overview?.ordersDelta}
              color="text-green-500"
            />
            <KpiCard
              icon={PercentIcon}
              label="Conversion Rate"
              value={fmtPercentRaw(overview?.conversionRate)}
              color="text-violet-500"
            />
            <KpiCard
              icon={DollarSign}
              label="Revenue"
              value={fmtCurrency(overview?.revenue ?? 0)}
              delta={overview?.revenueDelta}
              color="text-amber-500"
            />
          </>
        )}
      </div>

      {/* ── Time series chart ──────────────────────────────────────────────── */}
      {!ovLoading && overview?.series && overview.series.length > 0 && (
        <div className="bg-surface border border-border rounded-card p-6">
          <h2 className="text-sm font-semibold text-secondary mb-4">Visits over time</h2>
          <MiniChart series={overview.series} metric="visits" />
          <div className="flex justify-between mt-2 text-[10px] text-muted">
            <span>{overview.series[0]?.date}</span>
            <span>{overview.series[overview.series.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* ── Shopper Stats ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-secondary mb-3">Shopper Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {shLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            <>
              <div className="bg-surface border border-border rounded-card p-5 flex items-center gap-4">
                <Heart className="w-8 h-8 text-red-400 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-secondary">{fmtNum(shopper?.itemFavourites)}</p>
                  <p className="text-xs text-muted mt-0.5">Item favourites</p>
                  <div className="mt-0.5">{shopper?.favouritesDelta !== undefined && delta(shopper.favouritesDelta)}</div>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-card p-5 flex items-center gap-4">
                <UserPlus className="w-8 h-8 text-blue-400 shrink-0" />
                <div>
                  <p className="text-2xl font-bold text-secondary">{fmtNum(shopper?.shopFollows)}</p>
                  <p className="text-xs text-muted mt-0.5">Shop follows</p>
                  <div className="mt-0.5">{shopper?.followsDelta !== undefined && delta(shopper.followsDelta)}</div>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-card p-5 flex items-center gap-4">
                <Star className="w-8 h-8 text-amber-400 shrink-0" />
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-bold text-secondary">{fmtNum(shopper?.reviewCount)}</p>
                    {shopper?.avgRating && (
                      <span className="text-sm font-medium text-amber-500">({fmtRating(shopper.avgRating)} ★)</span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">Reviews</p>
                  <div className="mt-0.5">{shopper?.reviewsDelta !== undefined && delta(shopper.reviewsDelta)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Conversion Funnel ──────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-secondary mb-3">Conversion funnel</h2>
        <div className="bg-surface border border-border rounded-card divide-y divide-border">
          {srcLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
            </div>
          ) : (funnel ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted text-center">No funnel data for this period.</p>
          ) : (
            (funnel ?? []).map((s) => (
              <div key={s.stage} className="flex items-center gap-4 px-5 py-3">
                <span className="w-36 text-sm text-secondary shrink-0">{s.stage}</span>
                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, safeNum(s.percentage))}%` }}
                  />
                </div>
                <span className="text-sm text-muted w-20 text-right">{fmtNum(s.count)}</span>
                <span className="text-sm font-medium text-secondary w-12 text-right">{fmtPercentRaw(s.percentage, 0)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Top Searches (platform-wide only) ──────────────────────────────── */}
      {isPlatformContext && (searchTerms ?? []).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-secondary mb-3">Top searches</h2>
          <div className="bg-surface border border-border rounded-card divide-y divide-border">
            {(searchTerms ?? []).map((t) => (
              <div key={t.term} className="flex items-center gap-3 px-5 py-2.5">
                <Search className="w-3.5 h-3.5 text-muted shrink-0" />
                <span className="flex-1 text-sm text-secondary truncate">{t.term}</span>
                <span className="text-sm text-muted">{fmtNum(t.count)} searches</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top listings preview ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-secondary">Shoppers viewed your listings</h2>
          <Link
            href="/stats/listings"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            See all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/5">
                <th className="text-left px-4 py-3 font-medium text-muted text-xs">Listing</th>
                <th className="text-right px-4 py-3 font-medium text-muted text-xs">Views</th>
                <th className="text-right px-4 py-3 font-medium text-muted text-xs">Favourites</th>
                <th className="text-right px-4 py-3 font-medium text-muted text-xs">Orders</th>
                <th className="text-right px-4 py-3 font-medium text-muted text-xs">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(listingsData?.data ?? []).map((row) => (
                <tr
                  key={row.productId}
                  className="hover:bg-muted/5 transition-colors cursor-pointer group"
                  onClick={() => router.push(ADMIN_ROUTES.STATS_LISTING(row.productId))}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {row.imageUrl ? (
                        <img src={row.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded bg-border shrink-0" />
                      )}
                      <span className="text-secondary line-clamp-2 text-xs font-medium max-w-[220px] group-hover:text-primary transition-colors">{row.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-secondary">{fmtNum(row.views)}</td>
                  <td className="px-4 py-3 text-right text-secondary">{fmtNum(row.favourites)}</td>
                  <td className="px-4 py-3 text-right text-secondary">{fmtNum(row.orders)}</td>
                  <td className="px-4 py-3 text-right font-medium text-secondary">{fmtCurrency(row.revenue)}</td>
                </tr>
              ))}
              {(listingsData?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                    No listing data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
