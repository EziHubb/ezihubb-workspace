import {
  DollarSign, PackageSearch, Clock, Hammer,
} from 'lucide-react';
import { serverFetch } from '../../../lib/api';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { StatCard } from '../../../components/data/StatCard';
import { RevenueChart } from '../../../components/charts/RevenueChart';
import { OrdersDonut } from '../../../components/charts/OrdersDonut';
import { TopProductsTable } from '../../../components/dashboard/TopProductsTable';
import { PendingReviewsCard } from '../../../components/dashboard/PendingReviewsCard';
import type { RevenueDataPoint } from '../../../components/charts/RevenueChart';
import type { OrderStatusDataPoint } from '../../../components/charts/OrdersDonut';
import type { TopProductDto } from '../../../components/dashboard/TopProductsTable';
import type { ReviewDto } from '../../../components/dashboard/PendingReviewsCard';

export const metadata = { title: 'Dashboard — Maple Admin' };
export const dynamic  = 'force-dynamic';

// ── API response types ────────────────────────────────────────────────────────

interface KpiData {
  totalRevenue?:          number;
  revenueThisMonth?:      number;
  totalOrders?:           number;
  ordersThisMonth?:       number;
  pendingOrders?:         number;
  ordersInProduction?:    number;
  pendingReviews?:        number;
  totalCustomers?:        number;
  newCustomersThisMonth?: number;
  averageOrderValue?:     number;
}

interface RevenueChartResponse {
  data?:  RevenueDataPoint[];
  total?: number;
}

// ── Safe fetch ────────────────────────────────────────────────────────────────

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res  = await serverFetch(path);
    if (!res.ok) return fallback;
    const body = await res.json();
    return (body.data ?? body) as T;
  } catch {
    return fallback;
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const [kpis, revenueRaw, ordersByStatus, topProducts, pendingRaw] =
    await Promise.all([
      safeFetch<KpiData>('/admin/dashboard/kpis', {}),
      safeFetch<RevenueChartResponse | RevenueDataPoint[]>(
        '/admin/dashboard/revenue?days=30', [],
      ),
      safeFetch<OrderStatusDataPoint[]>('/admin/dashboard/orders-by-status', []),
      safeFetch<TopProductDto[]>('/admin/dashboard/top-products?limit=10', []),
      safeFetch<{ data?: ReviewDto[]; total?: number } | ReviewDto[]>(
        '/admin/dashboard/pending-reviews?limit=5', [],
      ),
    ]);

  // Normalise revenue chart data
  const revenueData  = Array.isArray(revenueRaw)
    ? revenueRaw
    : (revenueRaw.data ?? []);
  const revenueTotal = Array.isArray(revenueRaw)
    ? revenueData.reduce((s, d) => s + (d.revenue ?? 0), 0)
    : (revenueRaw.total ?? revenueData.reduce((s, d) => s + (d.revenue ?? 0), 0));

  // Normalise reviews
  const reviews     = Array.isArray(pendingRaw) ? pendingRaw : (pendingRaw.data ?? []);
  const totalPending = Array.isArray(pendingRaw) ? reviews.length : (pendingRaw.total ?? reviews.length);

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        subtitle="Your store at a glance"
      />

      {/* ── Row 1: KPI cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        <StatCard
          label="Revenue This Month"
          value={kpis.revenueThisMonth ?? 0}
          icon={DollarSign}
          color="coral"
          prefix="$"
        />
        <StatCard
          label="Orders This Month"
          value={kpis.ordersThisMonth ?? 0}
          icon={PackageSearch}
          color="blue"
        />
        <StatCard
          label="Awaiting Action"
          value={kpis.pendingOrders ?? 0}
          icon={Clock}
          color="amber"
        />
        <StatCard
          label="In Production"
          value={kpis.ordersInProduction ?? 0}
          icon={Hammer}
          color="blue"
        />
      </div>

      {/* ── Row 2: Charts ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[65fr_35fr] gap-5 mb-6">
        <RevenueChart
          initialData={revenueData as RevenueDataPoint[]}
          initialTotal={revenueTotal}
        />
        <OrdersDonut data={ordersByStatus} />
      </div>

      {/* ── Row 3: Tables ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[60fr_40fr] gap-5">
        <TopProductsTable products={topProducts} />
        <PendingReviewsCard
          initialReviews={reviews as ReviewDto[]}
          totalPending={totalPending}
        />
      </div>
    </>
  );
}
