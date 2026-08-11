'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ShoppingBag, DollarSign, Star, Package, TrendingUp, Clock } from 'lucide-react';
import { useAuthStore } from '../../../../lib/store/auth.store';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtRating } from '@ezihubb/utils';

interface DashboardStats {
  totalOrders:   number;
  pendingOrders: number;
  totalRevenue:  number;
  avgRating:     number | null;
  totalProducts: number;
  pendingPayout: number;
}

interface RecentOrder {
  id:          string;
  orderNumber: string;
  status:      string;
  total:       number;
  createdAt:   string;
  itemCount:   number;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED:    'bg-indigo-100 text-indigo-700',
  DELIVERED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
};

export default function SellerDashboard() {
  const t      = useTranslations('seller');
  const locale = useLocale();
  const token  = useAuthStore((s) => s.accessToken);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['seller-dashboard-stats'],
    queryFn:  () => apiClient.get<DashboardStats>(API_ROUTES.SELLER.DASHBOARD_STATS, { token: token ?? undefined }),
    enabled:  !!token,
  });

  const { data: recentOrders = [], isLoading: ordersLoading } = useQuery<RecentOrder[]>({
    queryKey: ['seller-dashboard-recent'],
    queryFn:  () => apiClient.get<RecentOrder[]>(API_ROUTES.SELLER.DASHBOARD_RECENT, { token: token ?? undefined }),
    enabled:  !!token,
  });

  const STAT_CARDS = [
    { label: t('dashboard.stats.totalOrders'),    value: stats?.totalOrders   ?? 0,      icon: ShoppingBag, color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: t('dashboard.stats.revenue'),         value: fmtAmount(stats?.totalRevenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: t('dashboard.stats.avgRating'),      value: stats?.avgRating != null ? fmtRating(stats.avgRating) : '—', icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: t('dashboard.stats.activeProducts'), value: stats?.totalProducts ?? 0,      icon: Package,    color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: t('dashboard.stats.pendingOrders'),  value: stats?.pendingOrders ?? 0,      icon: Clock,      color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: t('dashboard.stats.pendingPayout'),  value: fmtAmount(stats?.pendingPayout), icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/5' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-secondary">{t('dashboard.title')}</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4 space-y-2">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            {statsLoading ? (
              <div className="h-6 w-16 bg-border/30 rounded animate-pulse" />
            ) : (
              <p className="text-lg font-bold text-secondary">{value}</p>
            )}
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-secondary">{t('dashboard.recentOrders')}</h2>
        </div>
        {ordersLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-border/20 rounded animate-pulse" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingBag className="w-10 h-10 text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-muted">{t('dashboard.noOrders')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-background/40">
              <tr>
                {[t('dashboard.table.order'), t('dashboard.table.items'), t('dashboard.table.total'), t('dashboard.table.status'), t('dashboard.table.date')].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-background/40 transition-colors">
                  <td className="px-5 py-3 font-medium text-secondary">{o.orderNumber}</td>
                  <td className="px-5 py-3 text-muted">{o.itemCount}</td>
                  <td className="px-5 py-3 font-semibold">{fmtAmount(o.total)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] ?? 'bg-border/30 text-muted'}`}>
                      {t.has(`status.${o.status}`) ? t(`status.${o.status}`) : o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(o.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
