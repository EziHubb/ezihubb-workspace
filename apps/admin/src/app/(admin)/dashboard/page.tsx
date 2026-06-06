import {
  DollarSign, PackageSearch, Clock, Hammer,
} from 'lucide-react';
import Link from 'next/link';
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

// ── Components ────────────────────────────────────────────────────────────────

function SeoHealthCard({
  label, value, max, status,
}: {
  label:  string;
  value:  number;
  max:    number;
  status: 'good' | 'warning' | 'error' | 'info';
}) {
  const cfgs = {
    good:    { border: 'border-green-200', bg: 'bg-green-50',  num: 'text-green-700',  dot: 'bg-green-400'  },
    warning: { border: 'border-amber-200', bg: 'bg-amber-50',  num: 'text-amber-700',  dot: 'bg-amber-400'  },
    error:   { border: 'border-red-200',   bg: 'bg-red-50',    num: 'text-red-700',    dot: 'bg-red-400'    },
    info:    { border: 'border-blue-200',  bg: 'bg-blue-50',   num: 'text-blue-700',   dot: 'bg-blue-400'   },
  };
  const cfg = cfgs[status];
  return (
    <div className={`${cfg.bg} ${cfg.border} border rounded-card p-4 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted truncate pr-2">{label}</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
      </div>
      <p className={`text-2xl font-bold tabular-nums ${cfg.num}`}>{value}</p>
      <p className="text-xs text-muted">of {max} products</p>
    </div>
  );
}

// ── API response types ────────────────────────────────────────────────────────

interface SeoStats {
  total:              number;
  missingTitle:       number;
  missingDescription: number;
  lowScore:           number;
  noIndex:            number;
}

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
  const [kpis, revenueRaw, ordersByStatus, topProducts, pendingRaw, seoStats] =
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
      safeFetch<SeoStats>('/admin/products/seo-stats', {
        total: 0, missingTitle: 0, missingDescription: 0, lowScore: 0, noIndex: 0,
      }),
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

      {/* ── Row 4: SEO Health ─────────────────────────────────────────────── */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-secondary">SEO Health</h3>
          <Link href="/products/seo" className="text-sm text-primary hover:underline">
            Fix issues →
          </Link>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <SeoHealthCard
            label="Missing SEO title"
            value={seoStats.missingTitle}
            max={seoStats.total}
            status={seoStats.missingTitle > 0 ? 'warning' : 'good'}
          />
          <SeoHealthCard
            label="Missing description"
            value={seoStats.missingDescription}
            max={seoStats.total}
            status={seoStats.missingDescription > 0 ? 'warning' : 'good'}
          />
          <SeoHealthCard
            label="Score < 70"
            value={seoStats.lowScore}
            max={seoStats.total}
            status={seoStats.lowScore > 0 ? 'error' : 'good'}
          />
          <SeoHealthCard
            label="No indexable"
            value={seoStats.noIndex}
            max={seoStats.total}
            status="info"
          />
        </div>
      </section>
    </>
  );
}
