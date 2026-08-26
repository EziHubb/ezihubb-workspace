'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  TrendingUp, ShoppingBag, PercentIcon, DollarSign,
  Heart, UserPlus, Star, ArrowRight, Search, Repeat, MapPin, ShoppingCart,
  ChevronDown, ThumbsUp, ThumbsDown, Check,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
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
  itemFavourites:   number;
  shopFollows:      number;
  reviewCount:      number;
  avgRating:        number | null;
  repeatBuyers:     number;
  citiesReached:    number;
  abandonedBaskets: number;
  favouritesDelta:  number;
  followsDelta:     number;
  reviewsDelta:     number;
}

interface FunnelStep {
  stage:      string;
  count:      number;
  percentage: number;
}

interface TrafficSourcesData {
  totalVisits: number;
  sources: Array<{ key: string; label: string; count: number; percentage: number }>;
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
  { label: 'Yesterday',    value: '1d'  },
  { label: 'Last 7 days',  value: '7d'  },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
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

/** `series[].date` is a plain "YYYY-MM-DD" string (see ShopStatsService.dateStr,
 *  UTC-explicit). `new Date("2026-08-13")` parses that as UTC midnight, and
 *  formatting it back in a negative-UTC-offset timezone (most of the
 *  Americas) rolls it back to "Aug 12" — so build the Date from explicit
 *  Y/M/D components instead of round-tripping through UTC. */
function fmtDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d));
}

/** "This month: 01 Aug – 13 Aug" style label for the currently-selected preset range. */
function rangeLabel(value: string): string {
  const opt = RANGE_OPTIONS.find((o) => o.value === value);
  const days = value === '1d' ? 1 : value === '7d' ? 7 : value === '90d' ? 90 : 30;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fmt = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: 'short' });
  return `${opt?.label ?? 'Last 7 days'}: ${fmt.format(from)} – ${fmt.format(to)}`;
}

/** "Updated just now" / "Updated 4 minutes ago" / "Updated 2 hours ago" —
 *  driven by the overview query's own `dataUpdatedAt` (React Query), so it
 *  reflects when data ACTUALLY last arrived (initial load, range change,
 *  store switch, or a background refetch), not a proxy like "did the range
 *  dropdown value change" that misses all the other cases. */
function useFreshness(dataUpdatedAt: number): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // React Query reports 0 before the first successful fetch resolves —
  // don't render a nonsense "Updated ~50 years ago" while still loading.
  if (!dataUpdatedAt) return 'Updating…';

  const seconds = Math.max(0, Math.round((now - dataUpdatedAt) / 1000));
  if (seconds < 60) return 'Updated just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
}

// ── Date range dropdown ───────────────────────────────────────────────────────

function DateRangeDropdown({
  value,
  onChange,
  dataUpdatedAt,
}: {
  value:          string;
  onChange:       (v: string) => void;
  dataUpdatedAt:  number;
}) {
  const [open, setOpen] = useState(false);
  const freshness = useFreshness(dataUpdatedAt);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-4 pr-3 py-2 rounded-full border border-border bg-surface text-sm font-medium text-secondary hover:border-primary/40 transition-colors"
      >
        {rangeLabel(value)}
        <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-48 bg-surface border border-border rounded-card shadow-floating z-20 py-1.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={[
                  'w-full text-left px-4 py-2 text-sm transition-colors',
                  value === opt.value ? 'text-primary font-semibold bg-primary/5' : 'text-secondary hover:bg-muted/5',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
      <span className="ml-3 text-xs text-muted inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> {freshness}
      </span>
    </div>
  );
}

// ── Trend chart (recharts) ────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-surface border border-border rounded-card px-3 py-2 shadow-floating text-sm">
      <p className="text-muted mb-0.5">{fmtDateShort(label)}</p>
      <p className="font-bold text-secondary">{payload[0].value.toLocaleString()} visits</p>
    </div>
  );
}

function TrendChart({ series }: { series: OverviewData['series'] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDateShort}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Line
          type="monotone"
          dataKey="visits"
          stroke="#E85D3F"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#E85D3F', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── "Is this helpful?" feedback ───────────────────────────────────────────────

function HelpfulFeedback() {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  if (voted) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Check className="w-3.5 h-3.5 text-success" /> Thanks for the feedback!
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      <span>Is this helpful?</span>
      <button
        type="button"
        onClick={() => setVoted('up')}
        aria-label="Yes, this is helpful"
        className="w-7 h-7 rounded-full flex items-center justify-center border border-border hover:border-primary/40 hover:text-primary transition-colors"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setVoted('down')}
        aria-label="No, this is not helpful"
        className="w-7 h-7 rounded-full flex items-center justify-center border border-border hover:border-error/40 hover:text-error transition-colors"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
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

// ── Shopper Stat Card (with description + CTA) ────────────────────────────────

function ShopperStatCard({
  icon: Icon,
  color,
  value,
  valueSuffix,
  deltaValue,
  label,
  description,
  cta,
}: {
  icon:         React.ElementType;
  color:        string;
  value:        string;
  valueSuffix?: string;
  deltaValue?:  number;
  label:        string;
  description:  string;
  cta?:         { label: string; href: string };
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center gap-3 mb-1">
        <Icon className={`w-5 h-5 shrink-0 ${color}`} />
        <span className="text-sm font-semibold text-secondary">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <p className="text-2xl font-bold text-secondary">{value}</p>
        {valueSuffix && <span className="text-sm font-medium text-amber-500">{valueSuffix}</span>}
        {deltaValue !== undefined && delta(deltaValue)}
      </div>
      <p className="text-xs text-muted leading-relaxed">{description}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-2"
        >
          {cta.label} <ArrowRight className="w-3 h-3" />
        </Link>
      )}
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
  const { isPlatformContext, ownStoreId } = useAdminMode();
  const [selectedStore, setSelectedStore] = useState<StoreOption | null>(null);

  // A platform-context Super Admin may drill into any single store's stats via
  // the picker below; everyone else (plain ADMIN, or Super Admin in "My Store"
  // mode) stays scoped to their own store exactly as before — omitting storeId
  // entirely is what keeps that ambient behavior unchanged.
  const explicitStoreId = isPlatformContext && selectedStore ? selectedStore.id : undefined;
  const qsStore = explicitStoreId ? `&storeId=${explicitStoreId}` : '';
  // Which store's settings/promotions the Shopper Stats CTAs deep-link into —
  // whichever store's data is actually on screen. In platform context this
  // must stay null unless a specific store is picked: falling back to the
  // Super Admin's own store here would silently point "Set up offer" at
  // their unrelated personal store while the numbers on screen are the
  // platform-wide aggregate.
  const ctaStoreId = isPlatformContext ? (explicitStoreId ?? null) : (ownStoreId || null);

  const { data: overview, isLoading: ovLoading, dataUpdatedAt: overviewUpdatedAt } = useQuery<OverviewData>({
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

  const { data: attribution, isLoading: attrLoading } = useQuery<TrafficSourcesData>({
    queryKey: ['stats-traffic-attribution', range, explicitStoreId],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.STATS_TRAFFIC_ATTRIBUTION}?range=${range}${qsStore}`),
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
        title="Stats"
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
      <DateRangeDropdown value={range} onChange={setRange} dataUpdatedAt={overviewUpdatedAt} />

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
          <TrendChart series={overview.series} />
        </div>
      )}

      {/* ── Shopper Stats ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-secondary">Shopper Stats</h2>
        </div>
        <p className="text-xs text-muted mb-3">
          Get a snapshot of how buyers interacted with your shop — stats are based on the date range set above.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shLoading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)
          ) : (
            <>
              <ShopperStatCard
                icon={Heart} color="text-red-400" value={fmtNum(shopper?.itemFavourites)}
                deltaValue={shopper?.favouritesDelta}
                label="Item favourites"
                description={
                  shopper && shopper.itemFavourites > 0
                    ? `${fmtNum(shopper.itemFavourites)} shopper${shopper.itemFavourites === 1 ? '' : 's'} favourited your items. Share a discount to help seal the deal.`
                    : "No favourites yet in this period. Share a discount when a shopper loves a listing to help seal the deal."
                }
                cta={ctaStoreId ? { label: 'Set up offer', href: ADMIN_ROUTES.PROMOTIONS } : undefined}
              />
              <ShopperStatCard
                icon={UserPlus} color="text-blue-400" value={fmtNum(shopper?.shopFollows)}
                deltaValue={shopper?.followsDelta}
                label="Shop follows"
                description={
                  shopper && shopper.shopFollows > 0
                    ? `${fmtNum(shopper.shopFollows)} new follower${shopper.shopFollows === 1 ? '' : 's'} this period.`
                    : "Looks like you don't have any new followers yet. Add your story to help buyers get to know you!"
                }
                cta={ctaStoreId ? { label: 'Add your story', href: ADMIN_ROUTES.STORE(ctaStoreId) } : undefined}
              />
              <ShopperStatCard
                icon={Star} color="text-amber-400" value={fmtNum(shopper?.reviewCount)}
                valueSuffix={shopper?.avgRating ? `(${fmtRating(shopper.avgRating)} ★)` : undefined}
                deltaValue={shopper?.reviewsDelta}
                label="Reviews"
                description={
                  shopper && shopper.reviewCount > 0
                    ? `Averaging ${fmtRating(shopper.avgRating ?? 0)} stars across ${fmtNum(shopper.reviewCount)} review${shopper.reviewCount === 1 ? '' : 's'} this period.`
                    : "Looks like you don't have any reviews yet. Read our tips on how to score a 5-star review!"
                }
                cta={{ label: 'Get tips', href: ADMIN_ROUTES.REVIEWS }}
              />
              <ShopperStatCard
                icon={Repeat} color="text-violet-400" value={fmtNum(shopper?.repeatBuyers)}
                label="Repeat buyers"
                description="Encourage more shoppers to come back — send a thank-you offer after their order dispatches."
                cta={ctaStoreId ? { label: 'Set up offer', href: ADMIN_ROUTES.PROMOTIONS } : undefined}
              />
              <ShopperStatCard
                icon={MapPin} color="text-teal-400" value={fmtNum(shopper?.citiesReached)}
                label="Cities reached"
                description={
                  shopper && shopper.citiesReached > 0
                    ? `Shipped to ${fmtNum(shopper.citiesReached)} different cit${shopper.citiesReached === 1 ? 'y' : 'ies'} this period.`
                    : "No orders shipped in this date range yet."
                }
              />
              <ShopperStatCard
                icon={ShoppingCart} color="text-orange-400" value={fmtNum(shopper?.abandonedBaskets)}
                label="Abandoned baskets"
                description="Next time shoppers leave items in their basket, you can send an offer automatically to nudge them to check out."
                cta={ctaStoreId ? { label: 'Set up offer', href: ADMIN_ROUTES.PROMOTIONS } : undefined}
              />
            </>
          )}
        </div>
        {!shLoading && <div className="mt-3"><HelpfulFeedback /></div>}
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

      {/* ── How shoppers found you ───────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold text-secondary mb-1">How shoppers found you</h2>
        <p className="text-xs text-muted mb-3">Where visits to your shop came from in this period.</p>
        <div className="bg-surface border border-border rounded-card divide-y divide-border">
          {attrLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6" />)}
            </div>
          ) : !attribution || attribution.totalVisits === 0 ? (
            <p className="p-6 text-sm text-muted text-center">No visit data for this period.</p>
          ) : (
            attribution.sources.map((s) => (
              <div key={s.key} className="flex items-center gap-4 px-5 py-3">
                <span className="w-56 text-sm text-secondary shrink-0">{s.label}</span>
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
          <div className="overflow-x-auto">
            {/* Scrolls itself rather than the page: a table cannot shrink
                below the width of its columns. */}
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
    </div>
  );
}
