'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Check, X } from 'lucide-react';
import { clientFetch } from '../../../../lib/api';
import { fmtNum, fmtAmount, fmtPercent, fmtFixed } from '../../../../lib/fmt';
import type { AdminProductDto } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d' | '1y' | 'all';

interface ChartPoint  { date: string; views: number; orders: number; revenue: number }
interface TrafficSource { name: string; views: number; percent: number }

interface PerformanceData {
  views:          number;
  viewsTotal:     number;
  favorites:      number;
  orders:         number;
  ordersTotal:    number;
  revenue:        number;
  conversionRate: number;
  avgRating:      number | null;
  reviewCount:    number;
  viewsTrend:     number | null;
  ordersTrend:    number | null;
  revenueTrend:   number | null;
  favoritesTrend: number | null;
  chartData:      ChartPoint[];
  trafficSources: TrafficSource[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGES: { id: Range; label: string }[] = [
  { id: '7d',  label: 'Last 7 days'  },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: '1y',  label: 'Last year'    },
  { id: 'all', label: 'All time'     },
];

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, trend,
}: {
  label:  string;
  value:  string;
  trend?: number | null;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-4 shadow-card">
      <p className="text-xs text-muted mb-1.5">{label}</p>
      <p className="text-2xl font-bold text-secondary tabular-nums leading-none">{value}</p>
      {trend != null && (
        <p className={`text-xs mt-2 font-medium flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {trend >= 0 ? '↑' : '↓'}
          {Math.abs(trend).toFixed(1)}% vs previous period
        </p>
      )}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?:  boolean;
  payload?: { value: number; dataKey: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length || !label) return null;
  let dateLabel = label;
  try { dateLabel = format(parseISO(label), 'MMM d, yyyy'); } catch { /* keep raw */ }

  return (
    <div className="bg-surface border border-border rounded-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-secondary mb-1">{dateLabel}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted capitalize">
          {p.dataKey}: <span className="font-medium text-secondary">
            {p.dataKey === 'revenue' ? fmtAmount(p.value) : fmtNum(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

// ── Quality check row ─────────────────────────────────────────────────────────

function QualityCheck({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      {passed
        ? <Check className="w-4 h-4 text-green-500 shrink-0" strokeWidth={2.5} />
        : <X     className="w-4 h-4 text-muted/40 shrink-0" strokeWidth={2}    />
      }
      <span className={`text-sm ${passed ? 'text-secondary' : 'text-muted'}`}>{label}</span>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PerformanceSkeleton() {
  return (
    <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6 animate-pulse">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-muted/10 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted/10 rounded-card" />
        ))}
      </div>
      <div className="h-56 bg-muted/10 rounded-card" />
      <div className="h-36 bg-muted/10 rounded-card" />
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

interface PerformanceTabProps { product: AdminProductDto }

export function PerformanceTab({ product }: PerformanceTabProps) {
  const [range, setRange] = useState<Range>('30d');

  const { data, isLoading, isFetching } = useQuery<PerformanceData>({
    queryKey: ['product-performance', product.id, range],
    queryFn:  async () => {
      const res  = await clientFetch(`/admin/products/${product.id}/performance?range=${range}`);
      const body = await res.json();
      return (body.data ?? body) as PerformanceData;
    },
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  if (isLoading) return <PerformanceSkeleton />;

  const d        = data;
  const pubDate  = product.publishedAt ?? product.createdAt;

  // Quality checks (read from product fields, no API call needed)
  const imageCount   = (product.images ?? []).length;
  const tagCount     = (product.productTags ?? []).length;
  const titleLen     = (product.name ?? '').length;

  return (
    <div className={`max-w-[900px] mx-auto px-6 py-8 space-y-8 transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}>

      {/* Header */}
      <div>
        <h2 className="text-base font-semibold text-secondary">Performance</h2>
        <p className="text-sm text-muted mt-0.5">
          Stats for this listing{pubDate ? ` since it was published on ${format(new Date(pubDate), 'MMM d, yyyy')}` : ''}.
        </p>
      </div>

      {/* Date range selector */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRange(r.id)}
            className={[
              'px-3 py-1.5 text-xs font-semibold rounded-full border transition-all',
              range === r.id
                ? 'bg-secondary text-white border-secondary'
                : 'text-muted border-border hover:border-secondary hover:text-secondary',
            ].join(' ')}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Views"
          value={fmtNum(d?.views)}
          trend={d?.viewsTrend}
        />
        <KpiCard
          label="Favorites"
          value={fmtNum(d?.favorites)}
          trend={d?.favoritesTrend}
        />
        <KpiCard
          label="Orders"
          value={fmtNum(d?.orders)}
          trend={d?.ordersTrend}
        />
        <KpiCard
          label="Revenue"
          value={fmtAmount(d?.revenue)}
          trend={d?.revenueTrend}
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-background border border-border rounded-card px-4 py-3 text-center">
          <p className="text-[11px] text-muted uppercase tracking-wide mb-0.5">Conversion rate</p>
          <p className="text-lg font-bold text-secondary tabular-nums">{fmtPercent(d?.conversionRate)}</p>
        </div>
        <div className="bg-background border border-border rounded-card px-4 py-3 text-center">
          <p className="text-[11px] text-muted uppercase tracking-wide mb-0.5">Avg. rating</p>
          <p className="text-lg font-bold text-secondary tabular-nums">
            {d?.avgRating ? `${fmtFixed(d.avgRating, 1)} ★` : '—'}
          </p>
        </div>
        <div className="bg-background border border-border rounded-card px-4 py-3 text-center">
          <p className="text-[11px] text-muted uppercase tracking-wide mb-0.5">Total sold</p>
          <p className="text-lg font-bold text-secondary tabular-nums">{fmtNum(d?.ordersTotal)}</p>
        </div>
      </div>

      {/* Views over time chart */}
      <div>
        <h4 className="text-sm font-semibold text-secondary mb-3">Views over time</h4>
        <div className="bg-surface border border-border rounded-card p-4 shadow-card">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={d?.chartData ?? []}
              margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#E85D3F" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#E85D3F" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                tickFormatter={(d: string) => {
                  try { return format(parseISO(d), range === '7d' ? 'EEE' : 'MMM d'); } catch { return d; }
                }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E85D3F', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#E85D3F"
                strokeWidth={2}
                fill="url(#viewsGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#E85D3F', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Traffic sources */}
      {(d?.trafficSources ?? []).length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-secondary mb-3">Traffic sources</h4>
          <div className="bg-surface border border-border rounded-card p-5 shadow-card space-y-3">
            {(d?.trafficSources ?? []).map((src) => (
              <div key={src.name} className="flex items-center gap-3">
                <span className="text-sm text-muted w-36 shrink-0">{src.name}</span>
                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${src.percent}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-secondary w-12 text-right tabular-nums">
                  {fmtNum(src.views)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Listing quality checklist */}
      <div>
        <h4 className="text-sm font-semibold text-secondary mb-3">Listing quality</h4>
        <div className="bg-[#F9FAFB] border border-border rounded-card p-5 space-y-0.5">
          <QualityCheck
            label={`Has at least 5 photos (${imageCount}/5)`}
            passed={imageCount >= 5}
          />
          <QualityCheck
            label={`Title is 30–140 characters (${titleLen} chars)`}
            passed={titleLen >= 30 && titleLen <= 140}
          />
          <QualityCheck
            label={`Has at least 3 tags (${tagCount} added)`}
            passed={tagCount >= 3}
          />
          <QualityCheck
            label="Has a description"
            passed={!!(product.shortDescription ?? (product.description && product.description.length > 10))}
          />
          <QualityCheck
            label="Has a processing profile set"
            passed={!!product.processingProfileId}
          />
          <QualityCheck
            label="Has a shipping profile set"
            passed={!!product.shippingProfileId}
          />
          <QualityCheck
            label="Has a category"
            passed={!!(product.primaryCategoryId ?? product.categoryId)}
          />
        </div>
      </div>
    </div>
  );
}
