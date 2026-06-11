'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ShoppingBag, DollarSign, Clock, Star, Package } from 'lucide-react';
import { Skeleton } from '@mlh/ui';
import { useAuthQuery } from '../../../../lib/hooks/useAuthQuery';

interface DashboardStats {
  ordersToday:      number;
  revenueThisMonth: number;
  pendingShipments: number;
  rating:           number;
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
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-primary',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
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
    '/seller/orders/stats',
  );

  const { data: recent, isLoading: recentLoading } = useAuthQuery<RecentOrder[]>(
    ['seller', 'orders', 'recent'],
    '/seller/orders/recent',
  );

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold text-secondary">Dashboard</h1>

      {/* KPI cards */}
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

      {/* Recent orders */}
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

      {/* Quick links */}
      <section className="grid grid-cols-2 gap-3">
        {[
          { href: '/seller/products',  icon: Package,     label: 'Manage Products' },
          { href: '/seller/store',     icon: ShoppingBag, label: 'Store Settings'  },
        ].map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={`/${locale}${href}`}
            className="flex items-center gap-3 p-4 border border-border rounded-card hover:border-primary/40 transition-colors"
          >
            <Icon className="w-5 h-5 text-primary" />
            <span className="font-medium text-secondary text-sm">{label}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
