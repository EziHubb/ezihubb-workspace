'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import {
  Search, Download, Package, ChevronDown, X, SlidersHorizontal,
  Check, Filter,
} from 'lucide-react';
import { subDays, addDays } from 'date-fns';
import { OrderStatusBadge } from '../../../components/orders/OrderStatusBadge';
import { OrderDetailPanel } from '../../../components/orders/OrderDetailPanel';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import type { OrderDetail } from '../../../components/orders/OrderDrawer';
import { api, adminApi } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtDate, unwrapArr } from '../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderRow {
  id:            string;
  orderNumber:   string;
  status:        string;
  total:         number;
  itemCount:     number;
  createdAt:     string;
  imageUrl?:     string | null;
  previewUrl?:   string | null;
  shippingName:  string;
  shippingCity:  string;
  shippingCountry: string;
  shippingMethod: string;
  shippingCost:  number;
  customer?: {
    id: string;
    firstName?: string | null;
    lastName?:  string | null;
    email: string;
  } | null;
}

interface OrdersResponse {
  data: OrderRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
  statusCounts?: Record<string, number>;
}

// ── Status tab config ─────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: '',             label: 'All'          },
  { key: 'CONFIRMED',    label: 'New'          },
  { key: 'IN_PRODUCTION',label: 'In Production'},
  { key: 'SHIPPED',      label: 'Shipped'      },
  { key: 'DELIVERED',    label: 'Delivered'    },
  { key: 'COMPLETED',    label: 'Completed'    },
  { key: 'CANCELLED',    label: 'Cancelled'    },
] as const;

// ── Date presets ──────────────────────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

const DATE_PRESETS = [
  { key: 'today',    label: 'Today',        range: () => { const t = new Date(); return { from: toISO(t), to: toISO(t) }; } },
  { key: 'last7',    label: 'Last 7 days',  range: () => ({ from: toISO(subDays(new Date(), 6)), to: toISO(new Date()) }) },
  { key: 'last30',   label: 'Last 30 days', range: () => ({ from: toISO(subDays(new Date(), 29)), to: toISO(new Date()) }) },
  { key: 'dispatch', label: 'Dispatch soon', range: () => ({ from: toISO(new Date()), to: toISO(addDays(new Date(), 3)) }) },
];

// ── CSV export ────────────────────────────────────────────────────────────────

async function exportCSV(params: URLSearchParams) {
  const res  = await adminApi.get(`${API_ROUTES.ADMIN.ORDERS_EXPORT}?${params.toString()}`, { responseType: 'blob' });
  const blob = res.data as Blob;
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Dispatch estimate ─────────────────────────────────────────────────────────

function dispatchByDate(createdAt: string): string {
  const d = addDays(new Date(createdAt), 3);
  return fmtDate(d.toISOString());
}

function isDispatchOverdue(createdAt: string): boolean {
  return addDays(new Date(createdAt), 3) < new Date();
}

// ── Bulk status dropdown ──────────────────────────────────────────────────────

function BulkStatusDropdown({ selectedIds, onDone }: { selectedIds: string[]; onDone: () => void }) {
  const [open, setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const STATUSES = [
    { status: 'PENDING_PAYMENT',  label: 'Mark as Pending Payment'  },
    { status: 'CONFIRMED',        label: 'Mark as Confirmed'        },
    { status: 'IN_PRODUCTION',    label: 'Start Production'         },
    { status: 'SHIPPED',          label: 'Mark as Shipped'          },
    { status: 'DELIVERED',        label: 'Mark as Delivered'        },
    { status: 'COMPLETED',        label: 'Mark as Completed'        },
    { status: 'CANCELLED',        label: 'Cancel orders'            },
    { status: 'REFUND_REQUESTED', label: 'Mark Refund Requested'    },
    { status: 'REFUNDED',         label: 'Mark as Refunded'         },
    { status: 'DISPUTED',         label: 'Mark as Disputed'         },
  ];

  const updateAll = async (status: string) => {
    setSaving(true);
    setOpen(false);
    try {
      await Promise.all(
        selectedIds.map((id) => api.patch(API_ROUTES.ADMIN.ORDER_STATUS(id), { status })),
      );
      onDone();
    } catch { /* silent */ } finally { setSaving(false); }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={saving || !selectedIds.length}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-button hover:bg-primary-dark disabled:opacity-50 transition-colors"
      >
        {saving ? 'Updating…' : 'Update progress'}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[200px] bg-surface border border-border rounded-xl shadow-xl py-1">
          {STATUSES.map((s) => (
            <button
              key={s.status}
              type="button"
              onClick={() => updateAll(s.status)}
              className="w-full text-left px-4 py-2.5 text-sm text-secondary hover:bg-muted/8 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({
  order,
  selected,
  onToggle,
  onClick,
}: {
  order:    OrderRow;
  selected: boolean;
  onToggle: () => void;
  onClick:  () => void;
}) {
  const thumb = order.imageUrl ?? order.previewUrl;
  const name  = order.customer
    ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') || order.customer.email
    : order.shippingName || 'Guest';
  const overdue = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION'].includes(order.status) && isDispatchOverdue(order.createdAt);

  return (
    <div
      className={[
        'flex items-start gap-3 px-4 py-3.5 border-b border-border last:border-0 hover:bg-muted/4 cursor-pointer transition-colors group',
        selected ? 'bg-primary/4' : '',
      ].join(' ')}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div
        className="mt-0.5 shrink-0"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        <div className={[
          'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer',
          selected ? 'bg-primary border-primary' : 'border-border hover:border-primary/50 bg-background',
        ].join(' ')}>
          {selected && <Check className="w-2.5 h-2.5 text-white" />}
        </div>
      </div>

      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-background border border-border shrink-0">
        {thumb ? (
          <Image src={thumb} alt={order.orderNumber} width={56} height={56} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-5 h-5 text-border" />
          </div>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-x-4 gap-y-0.5">
        {/* Col 1: order + buyer */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-primary">#{order.orderNumber}</span>
            <OrderStatusBadge status={order.status} size="sm" />
          </div>
          <p className="text-sm font-medium text-secondary mt-0.5 truncate">{name}</p>
          <p className="text-xs text-muted">
            {order.shippingCity}{order.shippingCountry ? `, ${order.shippingCountry}` : ''}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {order.itemCount} item{order.itemCount !== 1 ? 's' : ''} · {fmtDate(order.createdAt)}
          </p>
        </div>

        {/* Col 2: dispatch */}
        <div className="text-right sm:text-left sm:min-w-[110px]">
          <p className="text-xs text-muted">Dispatch by</p>
          <p className={`text-sm font-semibold ${overdue ? 'text-error' : 'text-secondary'}`}>
            {dispatchByDate(order.createdAt)}
          </p>
          <p className="text-xs text-muted mt-0.5 truncate max-w-[140px]">{order.shippingMethod}</p>
        </div>

        {/* Col 3: total */}
        <div className="text-right sm:min-w-[80px]">
          <p className="text-sm font-bold text-secondary tabular-nums">${Number(order.total).toFixed(2)}</p>
          {order.shippingCost > 0 && (
            <p className="text-xs text-muted">+${Number(order.shippingCost).toFixed(2)} ship</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter sidebar ────────────────────────────────────────────────────────────

interface Filters {
  datePreset:  string;
  country:     string;
  giftOnly:    boolean;
  withNotes:   boolean;
}

function FilterSidebar({
  filters,
  onChange,
  onClear,
}: {
  filters:  Filters;
  onChange: (f: Partial<Filters>) => void;
  onClear:  () => void;
}) {
  const hasFilters = !!filters.datePreset || !!filters.country || filters.giftOnly || filters.withNotes;

  return (
    <div className="w-full lg:w-64 shrink-0 bg-surface border border-border rounded-card p-4 self-start lg:sticky top-4 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-secondary flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted" /> Filters
        </p>
        {hasFilters && (
          <button type="button" onClick={onClear} className="text-xs text-muted hover:text-error underline">
            Clear all
          </button>
        )}
      </div>

      {/* Dispatch date */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Dispatch date</p>
        <div className="space-y-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange({ datePreset: filters.datePreset === p.key ? '' : p.key })}
              className={[
                'w-full text-left px-3 py-1.5 text-sm rounded-button transition-colors',
                filters.datePreset === p.key
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-secondary hover:bg-muted/8',
              ].join(' ')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Destination */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Destination</p>
        <input
          value={filters.country}
          onChange={(e) => onChange({ country: e.target.value })}
          placeholder="Country code (e.g. US)"
          className="w-full px-3 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Order attributes */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Order attributes</p>
        <div className="space-y-2">
          {[
            { key: 'giftOnly',  label: 'Gift orders only'   },
            { key: 'withNotes', label: 'Orders with notes'  },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer group">
              <div
                onClick={() => onChange({ [key]: !filters[key as keyof Filters] })}
                className={[
                  'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                  filters[key as keyof Filters]
                    ? 'bg-primary border-primary'
                    : 'border-border group-hover:border-primary/50 bg-background',
                ].join(' ')}
              >
                {filters[key as keyof Filters] && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <span className="text-sm text-secondary">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [page,          setPage]          = useState(1);
  const [activeTab,     setActiveTab]     = useState('');
  const [search,        setSearch]        = useState('');
  const [debouncedSearch, setDebounced]   = useState('');
  const [selected,      setSelected]      = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [exporting,     setExporting]     = useState(false);
  const [showFilters,   setShowFilters]   = useState(true);
  const [filters,       setFilters]       = useState<Filters>({
    datePreset: '', country: '', giftOnly: false, withNotes: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [activeTab, debouncedSearch, filters]);

  // Build query params
  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set('page',  String(page));
    p.set('limit', '20');
    if (activeTab)        p.set('status', activeTab);
    if (debouncedSearch)  p.set('search', debouncedSearch);
    if (filters.country)  p.set('country', filters.country);
    if (filters.giftOnly) p.set('isGift', 'true');
    if (filters.datePreset) {
      const preset = DATE_PRESETS.find((d) => d.key === filters.datePreset);
      if (preset) {
        const range = preset.range();
        p.set('from', range.from);
        p.set('to',   range.to);
      }
    }
    return p;
  }, [page, activeTab, debouncedSearch, filters]);

  // Fetch orders
  const { data, isLoading, refetch } = useQuery<OrdersResponse>({
    queryKey: ['admin-orders', page, activeTab, debouncedSearch, filters],
    queryFn:  () => api.get<OrdersResponse>(`${API_ROUTES.ADMIN.ORDERS}?${buildParams()}`),
  });

  const orders       = unwrapArr<OrderRow>(data?.data ?? data);
  const pagination   = (data as { pagination?: { page: number; limit: number; total: number } } | null)?.pagination;
  const statusCounts = data?.statusCounts ?? {};
  const totalCount   = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // Open order detail
  const openOrder = useCallback(async (order: OrderRow) => {
    const detail = await api.get<OrderDetail>(API_ROUTES.ADMIN.ORDER(order.id));
    setSelectedOrder(detail);
  }, []);

  // Toggle row selection
  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = () => {
    if (selected.size === orders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(orders.map((o) => o.id)));
    }
  };

  const allSelected = orders.length > 0 && selected.size === orders.length;

  const updateFilters = (partial: Partial<Filters>) => setFilters((f) => ({ ...f, ...partial }));
  const clearFilters  = () => setFilters({ datePreset: '', country: '', giftOnly: false, withNotes: false });

  const activeFilterCount = (filters.datePreset ? 1 : 0) + (filters.country ? 1 : 0) + (filters.giftOnly ? 1 : 0) + (filters.withNotes ? 1 : 0);

  return (
    <>
      <AdminPageHeader
        title="Orders"
        subtitle={pagination ? `${pagination.total} total orders` : undefined}
        queryKey={['admin-orders']}
      />

      {/* Search + toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order # or email…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setDebounced(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted/10 rounded-full"
            >
              <X className="w-3.5 h-3.5 text-muted" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={[
            'flex items-center gap-1.5 text-sm font-medium border rounded-button px-3 py-2 transition-colors',
            showFilters
              ? 'bg-primary/8 border-primary/30 text-primary'
              : 'border-border text-secondary hover:border-primary/40',
          ].join(' ')}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            // eslint-disable-next-line @typescript-eslint/no-empty-function -- swallow so setExporting(false) below still runs
            await exportCSV(buildParams()).catch(() => {});
            setExporting(false);
          }}
          className="flex items-center gap-1.5 text-sm font-medium text-secondary border border-border rounded-button px-3 py-2 hover:border-primary/40 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Status tabs */}
      <div className="bg-surface border border-border rounded-t-card border-b-0 overflow-x-auto">
        <div className="flex min-w-max">
          {STATUS_TABS.map((tab) => {
            const count = tab.key
              ? (statusCounts[tab.key] ?? 0)
              : totalCount;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setActiveTab(tab.key); setSelected(new Set()); }}
                className={[
                  'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  activeTab === tab.key
                    ? 'border-primary text-primary bg-primary/4'
                    : 'border-transparent text-muted hover:text-secondary hover:bg-muted/4',
                ].join(' ')}
              >
                {tab.label}
                {count > 0 && (
                  <span className={[
                    'text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
                    activeTab === tab.key
                      ? 'bg-primary text-white'
                      : 'bg-muted/15 text-muted',
                  ].join(' ')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main content: list + sidebar */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Orders list */}
        <div className="flex-1 min-w-0 bg-surface border border-border border-t-0 rounded-b-card overflow-hidden">
          {/* Bulk action bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-background/60">
            {/* Select all */}
            <div
              onClick={toggleAll}
              className={[
                'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer shrink-0',
                allSelected ? 'bg-primary border-primary' : 'border-border hover:border-primary/50 bg-background',
              ].join(' ')}
            >
              {allSelected && <Check className="w-2.5 h-2.5 text-white" />}
              {selected.size > 0 && !allSelected && <div className="w-2 h-0.5 bg-primary rounded" />}
            </div>

            {selected.size > 0 ? (
              <>
                <span className="text-sm font-medium text-primary">{selected.size} selected</span>
                <BulkStatusDropdown
                  selectedIds={[...selected]}
                  onDone={() => { setSelected(new Set()); refetch(); }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    await exportCSV(new URLSearchParams({ ids: [...selected].join(',') }));
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary/40 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              </>
            ) : (
              <span className="text-sm text-muted">
                {isLoading ? 'Loading…' : `${pagination?.total ?? 0} orders`}
              </span>
            )}
          </div>

          {/* Rows */}
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-border mx-auto mb-3" />
              <p className="text-secondary font-medium">No orders found</p>
              <p className="text-sm text-muted mt-1">Try adjusting your filters or search term.</p>
            </div>
          ) : (
            orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                selected={selected.has(order.id)}
                onToggle={() => toggleRow(order.id)}
                onClick={() => openOrder(order)}
              />
            ))
          )}

          {/* Pagination */}
          {pagination && pagination.total > pagination.limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted">
                Page {pagination.page} · {pagination.total} orders
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 text-xs border border-border rounded-button text-secondary disabled:opacity-40 hover:border-primary/40 transition-colors"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page * pagination.limit >= pagination.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs border border-border rounded-button text-secondary disabled:opacity-40 hover:border-primary/40 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filter sidebar */}
        {showFilters && (
          <FilterSidebar filters={filters} onChange={updateFilters} onClear={clearFilters} />
        )}
      </div>

      {/* Order detail panel */}
      {selectedOrder && (
        <OrderDetailPanel
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={() => { refetch(); setSelectedOrder(null); }}
        />
      )}
    </>
  );
}
