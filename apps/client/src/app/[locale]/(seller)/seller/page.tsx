'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  ShoppingBag, DollarSign, Clock, Star, Package,
  AlertTriangle, ChevronRight, BarChart2, Settings,
} from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { useAuthQuery } from '../../../../lib/hooks/useAuthQuery';
import { API_ROUTES } from '@mlh/constants';

interface DashboardStats {
  ordersToday:          number;
  revenueThisMonth:     number;
  pendingShipments:     number;
  rating:               number;
  flaggedProducts?:     number;
  pendingModerations?:  number;
}

interface RecentOrder {
  id:     string;
  status: string;
  sellerEarnings: number;
  order: { orderNumber: string; createdAt: string };
  items: { productName: string; quantity: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED:  'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  SHIPPED:    'bg-purple-100 text-purple-700',
  DELIVERED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
};

const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const $   = (n: number) => `$${n.toFixed(2)}`;

function StatCard({
  icon: Icon, label, value, sub, color = 'text-primary',
}: {
  icon:   React.ElementType;
  label:  string;
  value:  string | number;
  sub?:   string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5 space-y-2">
      <div className={`w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-secondary tabular-nums">{value}</p>
      <p className="text-sm text-muted">{label}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export default function SellerDashboardPage() {
  const locale = useLocale();

  const { data: stats, isLoading: statsLoading } = useAuthQuery<DashboardStats>(
    ['seller', 'orders', 'stats'],
    API_ROUTES.SELLER.DASHBOARD_STATS,
  );

  const { data: recent, isLoading: recentLoading } = useAuthQuery<RecentOrder[]>(
    ['seller', 'orders', 'recent'],
    API_ROUTES.SELLER.DASHBOARD_RECENT,
  );

  const hasModerationAlert = (stats?.flaggedProducts ?? 0) > 0 || (stats?.pendingModerations ?? 0) > 0;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-secondary">Dashboard</h1>

      {/* ── AI Moderation alert ───────────────────────────────────────────── */}
      {!statsLoading && hasModerationAlert && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-card text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800">Action required — content policy</p>
            <p className="text-amber-700 text-xs mt-0.5">
              {stats?.flaggedProducts
                ? `${stats.flaggedProducts} product${stats.flaggedProducts > 1 ? 's' : ''} flagged by our AI review system.`
                : ''}
              {stats?.pendingModerations
                ? ` ${stats.pendingModerations} item${stats.pendingModerations > 1 ? 's' : ''} pending review.`
                : ''}
              {' '}Please update your listings to comply with our policies.
            </p>
          </div>
          <Link href={`/${locale}/seller/products?moderationStatus=FLAGGED`}
            className="text-xs font-medium text-amber-800 hover:underline shrink-0">
            Review →
          </Link>
        </div>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-28 rounded-card" />
          ))
        ) : (
          <>
            <StatCard icon={ShoppingBag} label="Orders today"     value={stats?.ordersToday      ?? 0} />
            <StatCard icon={DollarSign}  label="Revenue this month" value={$(stats?.revenueThisMonth ?? 0)} sub="after platform fee" />
            <StatCard icon={Clock}       label="Pending shipments" value={stats?.pendingShipments ?? 0} color="text-amber-600" />
            <StatCard icon={Star}        label="Store rating"      value={stats?.rating?.toFixed(1) ?? '–'} />
          </>
        )}
      </div>

      {/* ── Recent orders ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-secondary">Recent Orders</h2>
          <Link href={`/${locale}/seller/orders`} className="text-sm text-primary hover:underline">
            View all →
          </Link>
        </div>

        {recentLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-16 rounded-card" />
            ))}
          </div>
        ) : !recent?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border border-dashed border-border rounded-card">
            <ShoppingBag className="w-10 h-10 text-muted/30" />
            <p className="text-sm text-muted">No orders yet — your first sale is on its way!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/${locale}/seller/orders/${o.id}`}
                className="flex items-center justify-between gap-4 p-4 border border-border rounded-card hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-secondary">{o.order.orderNumber}</p>
                  <p className="text-xs text-muted truncate">
                    {o.items.map((i) => `${i.productName} ×${i.quantity}`).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[o.status] ?? 'bg-muted/10 text-muted'}`}
                  >
                    {o.status}
                  </span>
                  <span className="text-sm font-bold text-secondary tabular-nums">{$(o.sellerEarnings)}</span>
                  <span className="text-xs text-muted">{fmt.format(new Date(o.order.createdAt))}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="font-semibold text-secondary mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/seller/products', icon: Package,    label: 'Manage Products',  sub: 'Add, edit, deactivate' },
            { href: '/seller/orders',   icon: ShoppingBag, label: 'View Orders',      sub: 'Fulfil pending orders' },
            { href: '/seller/payouts',  icon: DollarSign,  label: 'Payouts',          sub: 'View earnings & history' },
            { href: '/seller/store',    icon: Settings,    label: 'Store Settings',   sub: 'Name, logo, description' },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link
              key={href}
              href={`/${locale}${href}`}
              className="flex flex-col gap-2 p-4 border border-border rounded-card hover:border-primary/40 transition-colors group"
            >
              <Icon className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-secondary text-sm group-hover:text-primary transition-colors">{label}</p>
                <p className="text-xs text-muted mt-0.5">{sub}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted mt-auto self-end" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Analytics teaser ──────────────────────────────────────────────── */}
      <section className="border border-border rounded-card p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <BarChart2 className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-secondary text-sm">Analytics</p>
          <p className="text-xs text-muted mt-0.5">Track your store performance, top products, and traffic sources.</p>
        </div>
        <Link href={`/${locale}/seller/analytics`}
          className="shrink-0 text-sm font-medium text-primary hover:underline">
          View →
        </Link>
      </section>
    </div>
  );
}
