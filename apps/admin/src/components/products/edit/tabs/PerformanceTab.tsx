'use client';

import { useQuery } from '@tanstack/react-query';
import { Eye, ShoppingBag, Star, TrendingUp, Heart, MousePointerClick } from 'lucide-react';
import { clientFetch } from '../../../../lib/api';
import type { AdminProductDto } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProductStats {
  views30d:       number;
  viewsTotal:     number;
  favorites:      number;
  orders30d:      number;
  ordersTotal:    number;
  conversionRate: number;
  revenue30d:     number;
  avgRating:      number;
  reviewCount:    number;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color = 'coral',
}: {
  label:  string;
  value:  string | number;
  sub?:   string;
  icon:   React.ElementType;
  color?: 'coral' | 'blue' | 'green' | 'amber';
}) {
  const colorMap = {
    coral: { bg: 'bg-primary/10', text: 'text-primary'   },
    blue:  { bg: 'bg-blue-50',    text: 'text-blue-500'  },
    green: { bg: 'bg-green-50',   text: 'text-green-600' },
    amber: { bg: 'bg-amber-50',   text: 'text-amber-600' },
  };
  const c = colorMap[color];
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-5">
      <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center mb-3`}>
        <Icon className={`w-4.5 h-4.5 ${c.text}`} style={{ width: 18, height: 18 }} />
      </div>
      <p className="text-2xl font-bold text-secondary tabular-nums leading-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-muted mt-1">{label}</p>
      {sub && <p className="text-[11px] text-muted/60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

interface PerformanceTabProps { product: AdminProductDto }

export function PerformanceTab({ product }: PerformanceTabProps) {
  const { data: stats, isLoading } = useQuery<ProductStats>({
    queryKey: ['product-stats', product.id],
    queryFn:  async () => {
      const res  = await clientFetch(`/admin/products/${product.id}/stats`);
      const body = await res.json();
      return (body.data ?? body) as ProductStats;
    },
    staleTime: 5 * 60_000,
  });

  // Skeleton grid
  if (isLoading) {
    return (
      <div className="max-w-[820px] mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted/10 rounded-card border border-border" />
          ))}
        </div>
      </div>
    );
  }

  const s = stats ?? {
    views30d:       product.viewCount  ?? 0,
    viewsTotal:     product.viewCount  ?? 0,
    favorites:      0,
    orders30d:      0,
    ordersTotal:    product.soldCount  ?? 0,
    conversionRate: 0,
    revenue30d:     0,
    avgRating:      0,
    reviewCount:    0,
  };

  return (
    <div className="max-w-[820px] mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-secondary">Listing performance</h2>
        <p className="text-sm text-muted mt-0.5">Stats for the last 30 days and all-time.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Views (30 days)"   value={s.views30d}                  sub={`${s.viewsTotal.toLocaleString()} total`} icon={Eye}             color="blue"  />
        <StatCard label="Favorites"          value={s.favorites}                 icon={Heart}           color="coral" />
        <StatCard label="Orders (30 days)"   value={s.orders30d}                 sub={`${s.ordersTotal.toLocaleString()} total`} icon={ShoppingBag}    color="green" />
        <StatCard label="Conversion rate"    value={`${s.conversionRate.toFixed(1)}%`} icon={MousePointerClick}  color="amber" />
        <StatCard label="Revenue (30 days)"  value={`$${s.revenue30d.toFixed(2)}`} icon={TrendingUp}     color="green" />
        <StatCard label="Avg. rating"        value={s.avgRating ? `${s.avgRating.toFixed(1)} ★` : '—'} sub={s.reviewCount ? `${s.reviewCount} review${s.reviewCount !== 1 ? 's' : ''}` : 'No reviews'} icon={Star} color="amber" />
      </div>

      {/* Listing tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-card p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">💡 Improve visibility</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
          <li>Add all 13 tags to maximise search reach</li>
          <li>Include at least 5 high-quality photos</li>
          <li>Enable Etsy Ads in the Settings tab to boost exposure</li>
        </ul>
      </div>
    </div>
  );
}
