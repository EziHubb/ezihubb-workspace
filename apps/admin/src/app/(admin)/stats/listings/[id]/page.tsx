'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import {
  ArrowLeft, Eye, Heart, ShoppingBag, DollarSign,
  Star, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '../../../../../lib/api-client';
import { API_ROUTES, ADMIN_ROUTES } from '@mlh/constants';
import { fmtCurrency, fmtDate, fmtNum } from '../../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d';

interface ListingStatsData {
  product: {
    id:            string;
    name:          string;
    slug:          string;
    status:        string;
    isActive:      boolean;
    imageUrl:      string | null;
    basePrice:     number;
    compareAtPrice: number | null;
    createdAt:     string;
  };
  summary: {
    views:      number;
    orders:     number;
    revenue:    number;
    favourites: number;
    reviews:    number;
    avgRating:  number | null;
  };
  timeSeries: Array<{ date: string; visits: number; orders: number; revenue: number }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGES: { id: Range; label: string }[] = [
  { id: '7d',  label: 'Last 7 days'  },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  ARCHIVED: 'bg-orange-100 text-orange-700',
  DRAFT:    'bg-blue-100 text-blue-700',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-primary',
}: {
  icon:   React.ElementType;
  label:  string;
  value:  string;
  sub?:   string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-secondary tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?:  boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length || !label) return null;
  let dateLabel = label;
  try { dateLabel = fmtDate(label); } catch { /* keep raw */ }
  return (
    <div className="bg-surface border border-border rounded-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-secondary mb-1.5">{dateLabel}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-muted">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="capitalize">{p.dataKey}:</span>
          <span className="font-medium text-secondary">
            {p.dataKey === 'revenue' ? fmtCurrency(p.value) : fmtNum(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full  = Math.floor(rating);
  const half  = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < full ? 'text-amber-400 fill-amber-400' :
              i === full && half ? 'text-amber-400 fill-amber-200' :
              'text-border fill-border'
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-semibold text-secondary">{rating.toFixed(1)}</span>
      <span className="text-xs text-muted">({count} reviews)</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ListingStatsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }       = use(params);
  const [range, setRange] = useState<Range>('30d');
  const [metric, setMetric] = useState<'visits' | 'orders' | 'revenue'>('visits');

  const { data, isLoading, isFetching } = useQuery<ListingStatsData>({
    queryKey: ['listing-stats', id, range],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.STATS_LISTING(id)}?range=${range}`),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const p  = data?.product;
  const s  = data?.summary;
  const ts = data?.timeSeries ?? [];

  // Chart series — views / orders / revenue tabs
  const METRIC_CFG = {
    visits:  { label: 'Views',   color: '#6366f1', stroke: '#6366f1' },
    orders:  { label: 'Orders',  color: '#22c55e', stroke: '#22c55e' },
    revenue: { label: 'Revenue', color: '#f59e0b', stroke: '#f59e0b' },
  } as const;

  return (
    <div className="space-y-6">

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Link href={ADMIN_ROUTES.STATS} className="hover:text-secondary transition-colors">Stats</Link>
        <span>/</span>
        <Link href={ADMIN_ROUTES.STATS_LISTINGS} className="hover:text-secondary transition-colors">Listings</Link>
        <span>/</span>
        <span className="text-secondary truncate max-w-[200px]">{p?.name ?? 'Loading…'}</span>
      </div>

      {/* ── Product header ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex gap-4">
          <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      ) : p && (
        <div className="flex items-start gap-4">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name}
              className="w-20 h-20 rounded-lg object-cover border border-border shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-border shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-semibold text-secondary leading-snug line-clamp-2">{p.name}</h1>
              <a
                href={`/en/products/${p.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted border border-border rounded-button px-2.5 py-1.5 hover:border-primary/40 hover:text-primary transition-colors shrink-0"
              >
                <ExternalLink className="w-3 h-3" /> View
              </a>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {p.status}
              </span>
              <span className="text-sm font-bold text-secondary">{fmtCurrency(p.basePrice)}</span>
              {p.compareAtPrice && (
                <span className="text-xs text-muted line-through">{fmtCurrency(p.compareAtPrice)}</span>
              )}
              <span className="text-xs text-muted">Listed {fmtDate(p.createdAt)}</span>
            </div>
            {s?.avgRating != null && s.reviews > 0 && (
              <div className="mt-2">
                <StarRating rating={s.avgRating} count={s.reviews} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Date range selector ─────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={[
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              range === r.id
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-muted border-border hover:border-primary/40 hover:text-secondary',
            ].join(' ')}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard icon={Eye}        label="Views"      value={fmtNum(s?.views ?? 0)}           color="text-indigo-500" />
            <KpiCard icon={Heart}      label="Favourites" value={fmtNum(s?.favourites ?? 0)}       color="text-rose-500"   />
            <KpiCard icon={ShoppingBag}label="Orders"     value={fmtNum(s?.orders ?? 0)}           color="text-green-500"  />
            <KpiCard
              icon={DollarSign}
              label="Revenue"
              value={fmtCurrency(s?.revenue ?? 0)}
              sub={s?.orders ? `Avg ${fmtCurrency((s.revenue) / s.orders)} / order` : undefined}
              color="text-amber-500"
            />
          </>
        )}
      </div>

      {/* ── Time series chart ──────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card p-6">
        {/* Metric switcher */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-secondary">Performance over time</h2>
          <div className="flex gap-1">
            {(['visits', 'orders', 'revenue'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={[
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors border capitalize',
                  metric === m
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-transparent text-muted hover:text-secondary',
                ].join(' ')}
              >
                {METRIC_CFG[m].label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-52" />
        ) : ts.length === 0 ? (
          <p className="h-52 flex items-center justify-center text-sm text-muted">No data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ts} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={METRIC_CFG[metric].color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={METRIC_CFG[metric].color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => { try { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; } catch { return v; } }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => metric === 'revenue' ? `$${v}` : String(v)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={METRIC_CFG[metric].stroke}
                strokeWidth={2}
                fill="url(#grad)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Conversion funnel ──────────────────────────────────────────────── */}
      {!isLoading && s && (
        <div className="bg-surface border border-border rounded-card p-6">
          <h2 className="text-sm font-semibold text-secondary mb-4">Conversion funnel</h2>
          <div className="space-y-3">
            {[
              { label: 'Views',      value: s.views,      color: 'bg-indigo-400' },
              { label: 'Favourites', value: s.favourites, color: 'bg-rose-400'   },
              { label: 'Orders',     value: s.orders,     color: 'bg-green-400'  },
            ].map(({ label, value, color }) => {
              const pct = s.views > 0 ? Math.min(100, (value / s.views) * 100) : 0;
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-muted shrink-0">{label}</span>
                  <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 text-right text-sm font-medium text-secondary">{fmtNum(value)}</span>
                  <span className="w-14 text-right text-xs text-muted">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
          {s.views > 0 && s.orders > 0 && (
            <p className="mt-4 text-xs text-muted">
              Conversion rate (views → orders):
              <span className="font-semibold text-secondary ml-1">
                {((s.orders / s.views) * 100).toFixed(2)}%
              </span>
            </p>
          )}
        </div>
      )}

      {/* ── Bar chart: views vs orders ──────────────────────────────────────── */}
      {!isLoading && ts.length > 0 && (
        <div className="bg-surface border border-border rounded-card p-6">
          <h2 className="text-sm font-semibold text-secondary mb-4">Views vs Orders</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ts} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => { try { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; } catch { return v; } }}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="visits" name="Views"  fill="#6366f1" radius={[3,3,0,0]} maxBarSize={20} />
              <Bar dataKey="orders" name="Orders" fill="#22c55e" radius={[3,3,0,0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Reviews summary ──────────────────────────────────────────────────── */}
      {!isLoading && s && s.reviews > 0 && (
        <div className="bg-surface border border-border rounded-card p-6">
          <h2 className="text-sm font-semibold text-secondary mb-4">Reviews in period</h2>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-secondary">{s.avgRating?.toFixed(1) ?? '—'}</p>
              {s.avgRating != null && <StarRating rating={s.avgRating} count={s.reviews} />}
            </div>
            <div className="flex-1 space-y-2">
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs text-muted w-3">{star}</span>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full w-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
