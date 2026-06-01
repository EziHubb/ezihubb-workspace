'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Download, X } from 'lucide-react';
import { format, subDays, startOfMonth } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../../../components/data/DataTable';
import { OrderStatusBadge, ALL_STATUSES } from '../../../components/orders/OrderStatusBadge';
import { OrderDrawer } from '../../../components/orders/OrderDrawer';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import type { OrderDetail } from '../../../components/orders/OrderDrawer';
import { clientFetch } from '../../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderRow {
  id:          string;
  orderNumber: string;
  status:      string;
  total:       number;
  createdAt:   string;
  itemCount:   number;
  customer: {
    id:         string;
    firstName?: string;
    lastName?:  string;
    email:      string;
  };
}

interface OrdersResponse {
  data:  OrderRow[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

// ── Date range presets ────────────────────────────────────────────────────────

type DatePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'month' | 'custom';

function getDateRange(preset: DatePreset): { from: string; to: string } | null {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt   = (d: Date) => format(d, 'yyyy-MM-dd');

  switch (preset) {
    case 'today':     return { from: fmt(today),             to: fmt(today)              };
    case 'yesterday': return { from: fmt(subDays(today, 1)), to: fmt(subDays(today, 1))  };
    case 'last7':     return { from: fmt(subDays(today, 6)), to: fmt(today)              };
    case 'last30':    return { from: fmt(subDays(today, 29)),to: fmt(today)              };
    case 'month':     return { from: fmt(startOfMonth(today)), to: fmt(today)            };
    default:          return null;
  }
}

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today', yesterday: 'Yesterday', last7: 'Last 7 days',
  last30: 'Last 30 days', month: 'This month', custom: 'Custom',
};

// ── CSV export helper ─────────────────────────────────────────────────────────

async function exportCSV(params: URLSearchParams) {
  const res  = await clientFetch(`/admin/orders/export?${params.toString()}`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Filter state
  const [page,       setPage]       = useState(1);
  const [statusFilter, setStatus]   = useState<string>('');
  const [datePreset,   setPreset]   = useState<DatePreset | ''>('');
  const [search,       setSearch]   = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [selectedOrder, setSelected]   = useState<OrderDetail | null>(null);
  const [exporting,      setExporting] = useState(false);
  const [selectedRows,   setSelectedRows] = useState<OrderRow[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Build query params
  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    p.set('page',  String(page));
    p.set('limit', '20');
    if (statusFilter) p.set('status', statusFilter);
    if (debouncedSearch) p.set('search', debouncedSearch);
    const range = datePreset ? getDateRange(datePreset) : null;
    if (range) { p.set('from', range.from); p.set('to', range.to); }
    return p;
  }, [page, statusFilter, debouncedSearch, datePreset]);

  // Fetch orders
  const { data, isLoading, refetch } = useQuery<OrdersResponse>({
    queryKey: ['admin-orders', page, statusFilter, debouncedSearch, datePreset],
    queryFn:  async () => {
      const res  = await clientFetch(`/admin/orders?${buildParams()}`);
      const body = await res.json();
      return (body.data ?? body) as OrdersResponse;
    },
  });

  // Fetch order detail for drawer
  const openOrderDrawer = async (order: OrderRow) => {
    const res  = await clientFetch(`/admin/orders/${order.id}`);
    const body = await res.json();
    setSelected((body.data ?? body) as OrderDetail);
  };

  const orders = data?.data ?? [];
  const pagination = data?.pagination;

  // Active filter chips
  const chips: { label: string; clear: () => void }[] = [];
  if (statusFilter) chips.push({ label: `Status: ${statusFilter.replace(/_/g,' ')}`, clear: () => setStatus('') });
  if (datePreset)   chips.push({ label: PRESET_LABELS[datePreset], clear: () => setPreset('') });
  if (debouncedSearch) chips.push({ label: `"${debouncedSearch}"`, clear: () => { setSearch(''); setDebounced(''); }});

  // Columns
  const columns: ColumnDef<OrderRow>[] = [
    {
      accessorKey: 'orderNumber',
      header:      'Order #',
      cell:        ({ row }) => (
        <span className="font-mono text-sm font-medium text-primary">
          #{row.original.orderNumber}
        </span>
      ),
    },
    {
      id:      'customer',
      header:  'Customer',
      cell:    ({ row }) => {
        const c = row.original.customer;
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
        return (
          <div>
            <p className="text-sm font-medium text-secondary truncate max-w-[160px]">{name}</p>
            <p className="text-xs text-muted truncate max-w-[160px]">{c.email}</p>
          </div>
        );
      },
    },
    {
      accessorKey: 'itemCount',
      header:      'Items',
      cell:        ({ row }) => <span className="text-sm text-muted">{row.original.itemCount}</span>,
    },
    {
      accessorKey: 'createdAt',
      header:      'Date',
      cell:        ({ row }) => (
        <span className="text-sm text-muted whitespace-nowrap">
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header:      'Status',
      cell:        ({ row }) => <OrderStatusBadge status={row.original.status} size="sm" />,
    },
    {
      accessorKey: 'total',
      header:      'Total',
      cell:        ({ row }) => (
        <span className="text-sm font-semibold text-secondary tabular-nums">
          ${Number(row.original.total).toFixed(2)}
        </span>
      ),
    },
    {
      id:     'actions',
      header: '',
      size:   80,
      cell:   ({ row }) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openOrderDrawer(row.original); }}
          className="text-xs text-primary hover:underline font-medium"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <>
      <AdminPageHeader title="Orders" subtitle={pagination ? `${pagination.total} total orders` : undefined} />

      {/* Filter bar */}
      <div className="bg-surface border border-border rounded-card p-4 mb-4 flex flex-wrap items-center gap-3">
        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="">All Statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>

        {/* Date range */}
        <select
          value={datePreset}
          onChange={(e) => { setPreset(e.target.value as DatePreset); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
        >
          <option value="">All Dates</option>
          {(Object.keys(PRESET_LABELS) as DatePreset[]).filter((p) => p !== 'custom').map((p) => (
            <option key={p} value={p}>{PRESET_LABELS[p]}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Order # or email…"
            className="w-[260px] pl-8 pr-3 py-1.5 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>

        <div className="flex-1" />

        {/* Export */}
        <button
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            await exportCSV(buildParams()).catch(() => {});
            setExporting(false);
          }}
          className="flex items-center gap-1.5 text-sm font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary/40 disabled:opacity-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Active chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/8 text-primary border border-primary/20 rounded-pill px-2.5 py-1"
            >
              {chip.label}
              <button type="button" onClick={chip.clear} className="hover:text-primary-dark">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => { setStatus(''); setPreset(''); setSearch(''); setDebounced(''); setPage(1); }}
            className="text-xs text-muted hover:text-error underline"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedRows.length > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-button">
          <span className="text-sm font-medium text-primary">{selectedRows.length} selected</span>
          <button
            type="button"
            onClick={async () => {
              await exportCSV(
                new URLSearchParams({ ids: selectedRows.map((r) => r.id).join(',') }),
              );
            }}
            className="text-xs border border-primary/30 text-primary px-3 py-1 rounded-button hover:bg-primary/5"
          >
            Export Selected
          </button>
        </div>
      )}

      {/* Table */}
      <DataTable
        data={orders}
        columns={columns}
        isLoading={isLoading}
        selectable
        onRowClick={openOrderDrawer}
        emptyTitle="No orders found"
        emptyDesc="Try adjusting your filters."
        pagination={pagination ? {
          page:         pagination.page,
          limit:        pagination.limit,
          total:        pagination.total,
          onPageChange: setPage,
        } : undefined}
      />

      {/* Order drawer */}
      {selectedOrder && (
        <OrderDrawer
          order={selectedOrder}
          onClose={() => setSelected(null)}
          onUpdate={() => { refetch(); }}
        />
      )}
    </>
  );
}
