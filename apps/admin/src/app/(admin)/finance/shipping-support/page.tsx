'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  PackageCheck,
  Search,
  Store,
  Truck,
} from 'lucide-react';
import { API_ROUTES } from '@ezihubb/constants';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { FilterSelect } from '../../../../components/ui/FilterSelect';
import { api } from '../../../../lib/api-client';
import { fmtAmount, fmtDate, fmtDateTime } from '../../../../lib/fmt';

interface ShippingSupportSeriesPoint {
  date: string;
  committed: number;
  realized: number;
  orders: number;
}

interface ShippingSupportSummary {
  periodDays: number;
  committedSubsidy: number;
  realizedSubsidy: number;
  pendingSubsidy: number;
  supportedOrders: number;
  supportedShipments: number;
  averageSubsidyPerOrder: number;
  subsidyToMerchandisePercent: number;
  series: ShippingSupportSeriesPoint[];
  topStores: Array<{
    storeId: string;
    storeName: string;
    subsidy: number;
    orders: number;
  }>;
}

interface ShippingSupportRow {
  storeOrderId: string;
  orderId: string;
  orderNumber: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  buyerName: string;
  buyerEmail: string | null;
  orderStatus: string;
  fundingStatus: 'PENDING' | 'REALIZED';
  orderedAt: string;
  merchandiseSubtotal: number;
  quotedShippingCost: number;
  platformSubsidy: number;
  buyerShippingPaid: number;
  buyerStoreTotal: number;
}

interface ShippingSupportOrdersResponse {
  data: ShippingSupportRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All active support' },
  { value: 'pending', label: 'Pending support' },
  { value: 'realized', label: 'Realized support' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'subsidy', label: 'Highest support' },
  { value: 'order-value', label: 'Highest order value' },
];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const committed = payload.find((item) => item.dataKey === 'committed')?.value ?? 0;
  const realized = payload.find((item) => item.dataKey === 'realized')?.value ?? 0;
  return (
    <div className="rounded-card border border-border bg-surface px-3 py-2 text-sm shadow-floating">
      <p className="mb-1 font-medium text-secondary">{fmtDate(label)}</p>
      <p className="text-primary">Committed: {fmtAmount(committed)}</p>
      <p className="text-green-700">Realized: {fmtAmount(realized)}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Truck;
  tone: 'primary' | 'green' | 'amber' | 'blue';
}) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-card">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-secondary">{value}</p>
      <p className="mt-1 text-sm font-medium text-secondary">{label}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">{note}</p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-lg bg-muted/10" />
      ))}
    </div>
  );
}

export default function ShippingSupportPage() {
  const [days, setDays] = useState('30');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const summaryQuery = useQuery<ShippingSupportSummary>({
    queryKey: ['admin-finance-shipping-support-summary', days],
    queryFn: () => api.get<ShippingSupportSummary>(
      `${API_ROUTES.ADMIN.FINANCE_SHIPPING_SUPPORT_SUMMARY}?days=${days}`,
    ),
    staleTime: 60_000,
  });

  const ordersQuery = useQuery<ShippingSupportOrdersResponse>({
    queryKey: ['admin-finance-shipping-support-orders', days, status, sort, page, search],
    queryFn: () => {
      const params = new URLSearchParams({
        days,
        status,
        sort,
        page: String(page),
        limit: '20',
      });
      if (search) params.set('search', search);
      return api.get<ShippingSupportOrdersResponse>(
        `${API_ROUTES.ADMIN.FINANCE_SHIPPING_SUPPORT_ORDERS}?${params}`,
      );
    },
    staleTime: 30_000,
  });

  const summary = summaryQuery.data;
  const rows = ordersQuery.data?.data ?? [];
  const pagination = ordersQuery.data?.pagination;

  const changePeriod = (value: string) => {
    setDays(value);
    setPage(1);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  return (
    <div>
      <AdminPageHeader
        title="Shipping Support"
        subtitle="Platform-funded delivery costs, separated into committed and realized support."
        queryKey={['admin-finance-shipping-support']}
        actions={(
          <FilterSelect
            value={days}
            onChange={changePeriod}
            options={PERIOD_OPTIONS}
          />
        )}
      />

      <div className="mb-6 flex items-start gap-3 rounded-card border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
        <Truck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong>Committed</strong> is the support promised when an eligible order is placed.
          It becomes <strong>realized</strong> once the parcel is shipped. Cancelled and refunded
          orders are excluded from these totals.
        </p>
      </div>

      {summaryQuery.isLoading ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-card border border-border bg-surface" />
          ))}
        </div>
      ) : summaryQuery.isError ? (
        <div className="mb-6 rounded-card border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Shipping support totals could not be loaded. Please try again.
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Committed support"
            value={fmtAmount(summary?.committedSubsidy ?? 0)}
            note="All supported, non-cancelled orders"
            icon={Truck}
            tone="primary"
          />
          <MetricCard
            label="Realized support"
            value={fmtAmount(summary?.realizedSubsidy ?? 0)}
            note="Parcels already shipped or completed"
            icon={CheckCircle2}
            tone="green"
          />
          <MetricCard
            label="Pending support"
            value={fmtAmount(summary?.pendingSubsidy ?? 0)}
            note="Committed parcels not shipped yet"
            icon={Clock3}
            tone="amber"
          />
          <MetricCard
            label="Supported orders"
            value={String(summary?.supportedOrders ?? 0)}
            note={`${summary?.supportedShipments ?? 0} store shipments`}
            icon={PackageCheck}
            tone="blue"
          />
          <MetricCard
            label="Average per order"
            value={fmtAmount(summary?.averageSubsidyPerOrder ?? 0)}
            note={`${(summary?.subsidyToMerchandisePercent ?? 0).toFixed(1)}% of merchandise value`}
            icon={Store}
            tone="primary"
          />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="rounded-card border border-border bg-surface p-5 shadow-card" aria-labelledby="support-trend-title">
          <div className="mb-4">
            <h2 id="support-trend-title" className="font-semibold text-secondary">Support over time</h2>
            <p className="mt-0.5 text-xs text-muted">Daily platform shipping commitment and realized expense</p>
          </div>
          {summaryQuery.isLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted/10" />
          ) : (summary?.series.length ?? 0) === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted">No supported orders in this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={summary?.series ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="committedSupport" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E85D3F" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#E85D3F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EDE8" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => fmtDate(value)}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={(value: number) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="committed" stroke="#E85D3F" strokeWidth={2} fill="url(#committedSupport)" />
                <Area type="monotone" dataKey="realized" stroke="#15803D" strokeWidth={2} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Committed</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green-700" />Realized</span>
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface shadow-card" aria-labelledby="top-stores-title">
          <div className="border-b border-border px-5 py-4">
            <h2 id="top-stores-title" className="font-semibold text-secondary">Top supported stores</h2>
            <p className="mt-0.5 text-xs text-muted">By committed shipping support</p>
          </div>
          {summaryQuery.isLoading ? (
            <TableSkeleton />
          ) : (summary?.topStores.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-sm text-muted">No store data yet.</div>
          ) : (
            <ol className="divide-y divide-border">
              {summary?.topStores.map((store, index) => (
                <li key={store.storeId} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold text-muted">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/stores/${store.storeId}`} className="block truncate text-sm font-medium text-secondary hover:text-primary">
                      {store.storeName}
                    </Link>
                    <p className="text-xs text-muted">{store.orders} orders</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-primary">{fmtAmount(store.subsidy)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-card border border-border bg-surface shadow-card" aria-labelledby="support-detail-title">
        <div className="border-b border-border p-4 lg:flex lg:items-center lg:justify-between lg:gap-4">
          <div className="mb-3 lg:mb-0">
            <h2 id="support-detail-title" className="font-semibold text-secondary">Order detail</h2>
            <p className="mt-0.5 text-xs text-muted">{pagination?.total ?? 0} supported store shipments</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <form onSubmit={submitSearch} className="flex min-w-0 sm:w-72">
              <label className="relative block min-w-0 flex-1">
                <span className="sr-only">Search order, store, buyer, or email</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Order, store, buyer, email..."
                  className="h-9 w-full rounded-l-button border border-r-0 border-border bg-surface pl-9 pr-3 text-sm text-secondary outline-none focus:border-primary"
                />
              </label>
              <button type="submit" className="h-9 rounded-r-button bg-primary px-3 text-sm font-semibold text-white hover:bg-primary/90">
                Search
              </button>
            </form>
            <FilterSelect
              value={status}
              onChange={(value) => { setStatus(value); setPage(1); }}
              options={STATUS_OPTIONS}
              size="sm"
            />
            <FilterSelect
              value={sort}
              onChange={(value) => { setSort(value); setPage(1); }}
              options={SORT_OPTIONS}
              size="sm"
              align="right"
            />
          </div>
        </div>

        {ordersQuery.isLoading ? (
          <TableSkeleton />
        ) : ordersQuery.isError ? (
          <div className="p-10 text-center text-sm text-red-600">Order detail could not be loaded. Please try again.</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="mx-auto h-8 w-8 text-muted/60" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-secondary">No matching shipping support</p>
            <p className="mt-1 text-xs text-muted">Try a different period, status, or search term.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="border-b border-border bg-background text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Store</th>
                  <th className="px-4 py-3 font-semibold">Buyer</th>
                  <th className="px-4 py-3 text-right font-semibold">Merchandise</th>
                  <th className="px-4 py-3 text-right font-semibold">Shipping quote</th>
                  <th className="px-4 py-3 text-right font-semibold">Platform support</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.storeOrderId} className="hover:bg-background/50">
                    <td className="px-5 py-3.5">
                      <Link href={`/orders/${row.orderId}`} className="font-semibold text-secondary hover:text-primary">
                        #{row.orderNumber}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">{fmtDateTime(row.orderedAt)}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link href={`/stores/${row.storeId}`} className="font-medium text-secondary hover:text-primary">
                        {row.storeName}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">/{row.storeSlug}</p>
                    </td>
                    <td className="max-w-[220px] px-4 py-3.5">
                      <p className="truncate font-medium text-secondary">{row.buyerName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">{row.buyerEmail ?? 'No email'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-secondary">{fmtAmount(row.merchandiseSubtotal)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-secondary">{fmtAmount(row.quotedShippingCost)}</td>
                    <td className="px-4 py-3.5 text-right font-bold tabular-nums text-primary">{fmtAmount(row.platformSubsidy)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-semibold ${
                        row.fundingStatus === 'REALIZED'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {row.fundingStatus === 'REALIZED' ? 'Realized' : 'Pending'}
                      </span>
                      <p className="mt-1 text-[11px] text-muted">{row.orderStatus.replaceAll('_', ' ')}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <p className="text-xs text-muted">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={!pagination.hasPrev}
                className="rounded-button border border-border px-3 py-1.5 text-xs font-medium text-secondary hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!pagination.hasNext}
                className="flex items-center gap-1 rounded-button border border-border px-3 py-1.5 text-xs font-medium text-secondary hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
