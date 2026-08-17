import {
  DollarSign, PackageSearch, Clock, Hammer, Store, AlertTriangle,
  ShoppingBag, CheckCircle2, Flag, CreditCard, Star,
  TrendingUp, BarChart2, ShieldCheck, Package, AlertOctagon, Circle,
} from 'lucide-react';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth.options';
import { serverApi } from '../../../lib/api-client';
import { API_ROUTES, ADMIN_ROUTES } from '@ezihubb/constants';
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
import { fmtAmount, fmtRelative, unwrapArr, safeArr } from '../../../lib/fmt';

export const metadata = { title: 'Dashboard — EziHubb Admin' };
export const dynamic  = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface PlatformKpis {
  gmvToday?:              number;
  activeStores?:          number;
  pendingStores?:         number;
  openOrders?:            number;
  moderationQueue?:       number;
}

interface ActivityEvent {
  id:        string;
  type:      string;
  message:   string;
  timestamp: string;
  link?:     string;
}

interface TopStore {
  id:       string;
  name:     string;
  slug:     string;
  revenue:  number;
  orders:   number;
  rating:   number | null;
}

interface TopStoresResponse {
  stores?:   TopStore[];
}

interface ShopHealth {
  checklist: { shopName: boolean; logo: boolean; banner: boolean; story: boolean; sellerPhoto: boolean };
  listingsNeedingTitleWork: number;
  performanceScore: number | null;
  topTasks: { overdueOrders: number; ordersToSendToday: number; helpRequests: number; soldOutListings: number; inactiveListings: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try { return await serverApi<T>('get', path); }
  catch { return fallback; }
}

const ACTIVITY_ICONS: Record<string, { icon: typeof CheckCircle2; bg: string; color: string }> = {
  STORE_APPROVED:  { icon: CheckCircle2, bg: 'bg-green-100',  color: 'text-green-600'  },
  STORE_REJECTED:  { icon: Store,        bg: 'bg-red-100',    color: 'text-red-600'    },
  CONTENT_FLAGGED: { icon: Flag,         bg: 'bg-red-100',    color: 'text-red-600'    },
  PAYOUT_REQUEST:  { icon: CreditCard,   bg: 'bg-amber-100',  color: 'text-amber-600'  },
  REVIEW:          { icon: Star,         bg: 'bg-blue-100',   color: 'text-blue-600'   },
  ORDER:           { icon: ShoppingBag,  bg: 'bg-purple-100', color: 'text-purple-600' },
};

const DEFAULT_ACTIVITY = { icon: TrendingUp, bg: 'bg-gray-100', color: 'text-gray-600' };

// ── Sub-components ────────────────────────────────────────────────────────────

function SeoHealthCard({
  label, value, max, status,
}: {
  label:  string;
  value:  number;
  max:    number;
  status: 'good' | 'warning' | 'error' | 'info';
}) {
  const cfgs = {
    good:    { border: 'border-green-200', bg: 'bg-green-50',  num: 'text-green-700', dot: 'bg-green-400' },
    warning: { border: 'border-amber-200', bg: 'bg-amber-50',  num: 'text-amber-700', dot: 'bg-amber-400' },
    error:   { border: 'border-red-200',   bg: 'bg-red-50',    num: 'text-red-700',   dot: 'bg-red-400'   },
    info:    { border: 'border-blue-200',  bg: 'bg-blue-50',   num: 'text-blue-700',  dot: 'bg-blue-400'  },
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session    = await getServerSession(authOptions);
  const sessionUser = session?.user as Record<string, unknown> | undefined;
  const role        = sessionUser?.['role'] as string | undefined;
  // A SUPER_ADMIN switched into "My Store" mode (see AdminSidebar's store-context
  // toggle) sends the same X-Store-Context cookie serverApi() forwards as a
  // header — the backend then scopes/rejects requests exactly like it does for
  // a plain ADMIN, so this page must treat that case as a shop owner too,
  // or it'll call the platform-only endpoints and get a 403 from the API.
  const { cookies } = await import('next/headers');
  const inStoreMode = !!(await cookies()).get('ezihubb-store-context')?.value;
  const isShopOwner = role === 'ADMIN' || inStoreMode;

  const [
    kpis, revenueRaw, ordersByStatus, topProducts, pendingRaw, seoStats,
    platformKpis, activityRaw, topStoresData, shopHealth,
  ] = await Promise.all([
    safeFetch<KpiData>(API_ROUTES.ADMIN.DASHBOARD_KPIS, {}),
    safeFetch<RevenueChartResponse | RevenueDataPoint[]>(
      `${API_ROUTES.ADMIN.DASHBOARD_REVENUE}?days=30`, [],
    ),
    safeFetch<OrderStatusDataPoint[]>(API_ROUTES.ADMIN.DASHBOARD_BY_STATUS, []),
    safeFetch<TopProductDto[]>(`${API_ROUTES.ADMIN.DASHBOARD_TOP}?limit=10`, []),
    safeFetch<{ data?: ReviewDto[]; total?: number } | ReviewDto[]>(
      `${API_ROUTES.ADMIN.PENDING_REVIEWS}?limit=5`, [],
    ),
    safeFetch<SeoStats>(API_ROUTES.ADMIN.PRODUCTS_SEO_STATS, {
      total: 0, missingTitle: 0, missingDescription: 0, lowScore: 0, noIndex: 0,
    }),
    // Platform-wide data — only fetched for SUPER_ADMIN
    isShopOwner ? Promise.resolve({} as PlatformKpis) : safeFetch<PlatformKpis>(API_ROUTES.ADMIN.DASHBOARD_PLATFORM, {}),
    isShopOwner ? Promise.resolve([] as ActivityEvent[]) : safeFetch<ActivityEvent[]>(API_ROUTES.ADMIN.DASHBOARD_ACTIVITY, []),
    isShopOwner ? Promise.resolve({} as TopStoresResponse) : safeFetch<TopStoresResponse>(`${API_ROUTES.ADMIN.DASHBOARD_TOP_STORES}?limit=5`, {}),
    isShopOwner ? safeFetch<ShopHealth | null>(API_ROUTES.ADMIN.DASHBOARD_SHOP_HEALTH, null) : Promise.resolve(null as ShopHealth | null),
  ]);

  // Normalise revenue chart data
  const revenueData   = unwrapArr<RevenueDataPoint>(revenueRaw);
  const revenueTotal  = Array.isArray(revenueRaw)
    ? revenueData.reduce((s, d) => s + (d.revenue ?? 0), 0)
    : (revenueRaw.total ?? revenueData.reduce((s, d) => s + (d.revenue ?? 0), 0));

  // Normalise reviews
  const reviews      = unwrapArr<ReviewDto>(pendingRaw);
  const totalPending = Array.isArray(pendingRaw) ? reviews.length : (pendingRaw.total ?? reviews.length);

  const activityFeed  = safeArr(activityRaw);
  const topStores     = safeArr(topStoresData.stores);

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        subtitle={isShopOwner ? 'Your store overview' : 'Platform overview at a glance'}
        queryKey={false}
      />

      {/* ── Shop owner: search visibility + shop checklist + top tasks ─────── */}
      {isShopOwner && shopHealth && (() => {
        const checklistItems: { key: keyof ShopHealth['checklist']; label: string; desc?: string; href: string }[] = [
          { key: 'shopName',    label: 'Shop name added',   href: '/settings' },
          { key: 'logo',        label: 'Logo added',        href: '/settings' },
          { key: 'banner',      label: 'Banner added',      href: '/settings' },
          { key: 'story',       label: 'Share your story',  desc: 'Tell buyers about who you are, what inspires you, and how you create', href: '/settings' },
          { key: 'sellerPhoto', label: 'Upload a seller photo', desc: 'Introduce yourself with a friendly, clear photo', href: '/settings' },
        ];
        const doneCount = checklistItems.filter((c) => shopHealth.checklist[c.key]).length;
        const riskFactors = (shopHealth.listingsNeedingTitleWork > 0 ? 1 : 0) + (doneCount < checklistItems.length ? 1 : 0);

        return (
          <>
            {riskFactors > 0 && (
              <div className="bg-[#F3F1EC] rounded-card p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <AlertOctagon className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-secondary">
                      {riskFactors} factor{riskFactors !== 1 ? 's' : ''} risk{riskFactors === 1 ? 's' : ''} lowering your search visibility
                    </p>
                    <p className="text-xs text-muted mt-0.5">Improving photos, listing info, and more can help how you show up in search.</p>
                  </div>
                </div>
                <Link href="/search-visibility" className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white text-sm font-bold rounded-pill transition-colors shrink-0">
                  View search visibility
                </Link>
              </div>
            )}

            {doneCount < checklistItems.length && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-secondary">Customise your shop</h2>
                    <p className="text-xs text-muted mt-0.5">Showcase your brand&apos;s personality and build trust with buyers</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-1 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-secondary" style={{ width: `${(doneCount / checklistItems.length) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-muted">{doneCount}/{checklistItems.length}</span>
                  </div>
                </div>
                <div className="bg-surface border border-border rounded-card divide-y divide-border overflow-hidden">
                  {checklistItems.map((item) => {
                    const done = shopHealth.checklist[item.key];
                    return (
                      <Link key={item.key} href={item.href} className="flex items-start gap-3 px-4 py-3.5 hover:bg-background transition-colors">
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="w-5 h-5 text-border shrink-0 mt-0.5" strokeDasharray="3 3" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-secondary">{item.label} →</p>
                          {!done && item.desc && <p className="text-xs text-muted mt-0.5">{item.desc}</p>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="font-display text-lg font-bold text-secondary mb-3">Top tasks</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-surface border border-border rounded-card p-4">
                  <p className="text-sm font-bold text-secondary mb-1">Orders</p>
                  <p className="text-xs text-muted">{shopHealth.topTasks.overdueOrders} overdue order{shopHealth.topTasks.overdueOrders !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-muted">{shopHealth.topTasks.ordersToSendToday} order{shopHealth.topTasks.ordersToSendToday !== 1 ? 's' : ''} to send today</p>
                </div>
                <div className="bg-surface border border-border rounded-card p-4">
                  <p className="text-sm font-bold text-secondary mb-1">Messages</p>
                  <p className="text-xs text-muted">{shopHealth.topTasks.helpRequests} help request{shopHealth.topTasks.helpRequests !== 1 ? 's' : ''}</p>
                </div>
                <div className="bg-surface border border-border rounded-card p-4">
                  <p className="text-sm font-bold text-secondary mb-1">Listings</p>
                  <p className="text-xs text-muted">{shopHealth.topTasks.soldOutListings} item{shopHealth.topTasks.soldOutListings !== 1 ? 's' : ''} sold out</p>
                  <p className="text-xs text-muted">{shopHealth.topTasks.inactiveListings} listing{shopHealth.topTasks.inactiveListings !== 1 ? 's' : ''} inactive</p>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── SUPER_ADMIN-only sections ─────────────────────────────────────── */}
      {!isShopOwner && (<>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        {[
          { icon: DollarSign,   label: 'GMV Today',               value: fmtAmount(platformKpis.gmvToday              ?? 0), color: 'bg-primary'   },
          { icon: Store,        label: 'Active Stores',            value: String(platformKpis.activeStores             ?? 0), color: 'bg-green-500' },
          { icon: Clock,        label: 'Pending Stores',           value: String(platformKpis.pendingStores            ?? 0), color: 'bg-amber-500' },
          { icon: ShoppingBag,  label: 'Open Orders',              value: String(platformKpis.openOrders               ?? 0), color: 'bg-blue-500'  },
          { icon: AlertTriangle,label: 'Moderation Queue',         value: String(platformKpis.moderationQueue          ?? 0), color: 'bg-red-500'   },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted font-medium leading-tight">{label}</p>
              <p className="text-base font-bold text-secondary tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick actions grid (2×3) ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 mb-8">
        {[
          { href: `${ADMIN_ROUTES.STORES}?status=PENDING`,  label: 'Review Stores',       icon: Store,        badge: platformKpis.pendingStores ?? 0,          color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100'  },
          { href: ADMIN_ROUTES.MODERATION,                 label: 'Moderation Queue',    icon: ShieldCheck,  badge: platformKpis.moderationQueue ?? 0,        color: 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'          },
          { href: `${ADMIN_ROUTES.ORDERS}?status=PENDING`, label: 'Pending Orders',      icon: Package,      badge: kpis.pendingOrders ?? 0,                  color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100'      },
          { href: `${ADMIN_ROUTES.REVIEWS}?status=PENDING`,label: 'Pending Reviews',     icon: Star,         badge: totalPending,                             color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100'  },
          { href: ADMIN_ROUTES.FINANCE,                    label: 'Finance Overview',    icon: BarChart2,    badge: 0,                                        color: 'text-secondary bg-surface border-border hover:bg-background'     },
        ].map(({ href, label, icon: Icon, badge, color }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 px-4 py-3 border rounded-card text-sm font-medium transition-colors ${color}`}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 leading-tight">{label}</span>
            {badge > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-current/20 px-1.5 py-0.5 rounded-full tabular-nums">
                {badge}
              </span>
            )}
          </Link>
        ))}
      </div>
      </>)}

      {/* ── Seller quick-links (shop owner only) ─────────────────────────── */}
      {isShopOwner && (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { href: '/products/new',                         label: 'Add Product',    icon: ShoppingBag, color: 'text-primary bg-primary/5 border-primary/20 hover:bg-primary/10'        },
          { href: `${ADMIN_ROUTES.ORDERS}?status=PENDING`, label: 'Pending Orders', icon: Package,     color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100',   badge: kpis.pendingOrders  ?? 0 },
          { href: `${ADMIN_ROUTES.REVIEWS}?status=PENDING`,label: 'New Reviews',    icon: Star,        color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100', badge: totalPending },
          { href: '/messages',                             label: 'Messages',       icon: ShoppingBag, color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100'          },
        ].map(({ href, label, icon: Icon, color, badge }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-2.5 px-4 py-3 border rounded-card text-sm font-medium transition-colors ${color}`}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="flex-1 leading-tight">{label}</span>
            {badge != null && badge > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-current/20 px-1.5 py-0.5 rounded-full tabular-nums">{badge}</span>
            )}
          </Link>
        ))}
      </div>
      )}

      {/* ── Row 1: Revenue KPI cards ──────────────────────────────────────── */}
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
      <div className="grid grid-cols-1 lg:grid-cols-[60fr_40fr] gap-5 mb-8">
        <TopProductsTable products={topProducts} />
        <PendingReviewsCard
          initialReviews={reviews as ReviewDto[]}
          totalPending={totalPending}
        />
      </div>

      {/* ── Row 4: Activity feed + Top stores — SUPER_ADMIN only ── */}
      {!isShopOwner && (<>
      <div className="grid grid-cols-1 xl:grid-cols-[40fr_60fr] gap-6 mb-8">

        {/* Activity feed */}
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-secondary text-sm">Recent Activity</h3>
            <span className="text-xs text-muted">Live</span>
          </div>
          {activityFeed.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted">No recent activity.</div>
          ) : (
            <ul className="divide-y divide-border">
              {activityFeed.slice(0, 8).map((ev) => {
                const cfg = ACTIVITY_ICONS[ev.type] ?? DEFAULT_ACTIVITY;
                const Icon = cfg.icon;
                return (
                  <li key={ev.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-background transition-colors">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cfg.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-secondary leading-snug">
                        {ev.link
                          ? <Link href={ev.link} className="hover:underline">{ev.message}</Link>
                          : ev.message}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{fmtRelative(ev.timestamp)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-5">

          {/* Top stores */}
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-secondary text-sm">Top Stores This Month</h3>
              <Link href={ADMIN_ROUTES.STORES} className="text-xs text-primary hover:underline">View all →</Link>
            </div>
            {topStores.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted">No data yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background">
                    {['Store', 'Revenue', 'Orders', 'Rating'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {topStores.map((s, i) => (
                    <tr key={s.id} className="hover:bg-background transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted w-4 tabular-nums">#{i + 1}</span>
                          <Link href={ADMIN_ROUTES.STORE(s.id)}
                            className="text-xs font-semibold text-secondary hover:text-primary hover:underline truncate max-w-[120px]">
                            {s.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-secondary tabular-nums">{fmtAmount(s.revenue)}</td>
                      <td className="px-4 py-3 text-xs text-secondary tabular-nums">{s.orders}</td>
                      <td className="px-4 py-3 text-xs text-secondary">
                        {s.rating != null ? (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {s.rating.toFixed(1)}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      </>)}

      {/* ── Row 5: SEO Health ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-secondary">SEO Health</h3>
          <Link href={ADMIN_ROUTES.PRODUCTS_SEO} className="text-sm text-primary hover:underline">
            Fix issues →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
