'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Search, X, DollarSign, CreditCard,
  TrendingUp, AlertCircle, RotateCcw, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { DataTable } from '../../../components/data/DataTable';
import {
  PaymentDetailDrawer,
  type PaymentRecord,
  type PaymentStatus,
  type PaymentMethod,
} from '../../../components/payments/PaymentDetailDrawer';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtCurrency, fmtAmount, fmtPercent } from '../../../lib/fmt';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<PaymentStatus, { label: string; cls: string; dot: string }> = {
  PENDING:            { label: 'Pending',        cls: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  PAID:               { label: 'Paid',           cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  FAILED:             { label: 'Failed',         cls: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
  REFUNDED:           { label: 'Refunded',       cls: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400'   },
  PARTIALLY_REFUNDED: { label: 'Partial Refund', cls: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
};

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-xs font-semibold whitespace-nowrap ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Method badge ──────────────────────────────────────────────────────────────

const METHOD_CFG: Record<PaymentMethod, { label: string; icon: string; cls: string }> = {
  STRIPE:    { label: 'Stripe',    icon: '💳', cls: 'text-[#635BFF]' },
  PAYPAL:    { label: 'PayPal',    icon: '🅿',  cls: 'text-blue-600'  },
  GIFT_CARD: { label: 'Gift Card', icon: '🎁', cls: 'text-pink-600'   },
  MIXED:     { label: 'Mixed',     icon: '🔀', cls: 'text-purple-600' },
};

function MethodBadge({ method, cardBrand, cardLast4 }: {
  method:    PaymentMethod;
  cardBrand?: string;
  cardLast4?: string;
}) {
  const cfg = METHOD_CFG[method] ?? { label: method, icon: '💳', cls: 'text-gray-600' };
  return (
    <div>
      <span className={`text-sm font-medium ${cfg.cls}`}>
        {cfg.icon} {cfg.label}
      </span>
      {cardBrand && cardLast4 && (
        <p className="text-xs text-muted mt-0.5">{cardBrand} ••{cardLast4}</p>
      )}
    </div>
  );
}

// ── Mini stat card ────────────────────────────────────────────────────────────

function MiniStat({
  label, value, sub, icon: Icon, color = 'coral',
}: {
  label:  string;
  value:  string | number;
  sub?:   string;
  icon:   React.ElementType;
  color?: 'coral' | 'blue' | 'red' | 'green';
}) {
  const colorMap = {
    coral: { bg: 'bg-primary/10', text: 'text-primary'   },
    blue:  { bg: 'bg-blue-50',    text: 'text-blue-500'  },
    red:   { bg: 'bg-red-50',     text: 'text-red-500'   },
    green: { bg: 'bg-green-50',   text: 'text-green-600' },
  };
  const c = colorMap[color];
  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-secondary tabular-nums leading-tight">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted/60">{sub}</p>}
      </div>
    </div>
  );
}

// ── Stats interface ───────────────────────────────────────────────────────────

interface PaymentStats {
  revenueThisMonth:     number;
  totalTransactions:    number;
  refundsThisMonth:     number;
  successRate:          number;
}

// ── Date range options ────────────────────────────────────────────────────────

const DATE_OPTIONS = [
  { value: '',    label: 'All time'     },
  { value: '7',   label: 'Last 7 days'  },
  { value: '30',  label: 'Last 30 days' },
  { value: '90',  label: 'Last 90 days' },
];

const PAGE_SIZE = 20;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [method,     setMethod]     = useState('');
  const [status,     setStatus]     = useState('');
  const [dateRange,  setDateRange]  = useState('');
  const [drawer,     setDrawer]     = useState<PaymentRecord | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const statsQuery = useQuery<PaymentStats>({
    queryKey: ['payment-stats'],
    queryFn:  () => api.get<PaymentStats>(API_ROUTES.ADMIN.PAYMENTS_STATS),
    staleTime: 60_000,
  });
  const stats = statsQuery.data;

  // ── List ──────────────────────────────────────────────────────────────────

  const listKey = ['admin-payments', page, debouncedQ, method, status, dateRange];

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn:  async () => {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (debouncedQ) params['q']      = debouncedQ;
      if (method)     params['method'] = method;
      if (status)     params['status'] = status;
      if (dateRange)  params['days']   = dateRange;
      return api.get<{ data: PaymentRecord[]; total: number }>(API_ROUTES.ADMIN.PAYMENTS_LIST, { params });
    },
  });

  const payments = listQuery.data?.data ?? [];
  const total    = listQuery.data?.total ?? 0;

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<PaymentRecord>[]>(() => [
    {
      id:     'order',
      header: 'Order #',
      size:   120,
      cell:   ({ row }: { row: { original: PaymentRecord } }) => (
        <span className="font-mono font-semibold text-sm text-primary">
          #{row.original.orderNumber}
        </span>
      ),
    },
    {
      id:     'customer',
      header: 'Customer',
      size:   180,
      cell:   ({ row }: { row: { original: PaymentRecord } }) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-secondary truncate">{row.original.customerName}</p>
          <p className="text-xs text-muted truncate">{row.original.customerEmail}</p>
        </div>
      ),
    },
    {
      accessorKey: 'method',
      header:      'Method',
      size:        120,
      cell:        ({ row }: { row: { original: PaymentRecord } }) => (
        <MethodBadge
          method={row.original.method}
          cardBrand={row.original.cardBrand}
          cardLast4={row.original.cardLast4}
        />
      ),
    },
    {
      accessorKey: 'amount',
      header:      'Amount',
      size:        110,
      enableSorting: true,
      cell:        ({ row }: { row: { original: PaymentRecord } }) => (
        <div>
          <span className="text-sm font-bold text-secondary tabular-nums">
            ${(row.original.amount ?? 0).toFixed(2)}
          </span>
          {(row.original.refundedAmount ?? 0) > 0 && (
            <p className="text-xs text-orange-600 tabular-nums">
              −${(row.original.refundedAmount ?? 0).toFixed(2)} refunded
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header:      'Status',
      size:        130,
      cell:        ({ getValue }: { getValue: () => unknown }) => (
        <PaymentStatusBadge status={getValue() as PaymentStatus} />
      ),
    },
    {
      accessorKey: 'paidAt',
      header:      'Date',
      size:        110,
      enableSorting: true,
      cell:        ({ row }: { row: { original: PaymentRecord } }) => {
        const d = row.original.paidAt ?? row.original.createdAt;
        return (
          <span className="text-xs text-muted">
            {format(new Date(d), 'MMM d, yyyy')}
            <br />
            <span className="text-muted/60">{format(new Date(d), 'h:mm a')}</span>
          </span>
        );
      },
    },
    {
      id:   'actions',
      size: 120,
      header: '',
      cell: ({ row }: { row: { original: PaymentRecord } }) => {
        const p = row.original;
        const canRefund = p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED';
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setDrawer(p)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-muted hover:text-primary hover:bg-primary/5 rounded transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View
            </button>
            {canRefund && (
              <button
                type="button"
                onClick={() => setDrawer(p)}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Issue refund"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Refund
              </button>
            )}
          </div>
        );
      },
    },
  ], []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminPageHeader
        title="Payments"
        subtitle={`${total.toLocaleString()} transactions`}
      />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MiniStat
          label="Revenue This Month"
          value={stats ? fmtCurrency(stats.revenueThisMonth, 2) : '—'}
          icon={DollarSign}
          color="coral"
        />
        <MiniStat
          label="Total Transactions"
          value={stats?.totalTransactions ?? '—'}
          icon={CreditCard}
          color="blue"
        />
        <MiniStat
          label="Refunds This Month"
          value={stats ? fmtAmount(stats.refundsThisMonth) : '—'}
          icon={RotateCcw}
          color="red"
        />
        <MiniStat
          label="Success Rate"
          value={stats ? fmtPercent(stats.successRate) : '—'}
          icon={TrendingUp}
          color="green"
          sub={stats ? `${stats.successRate >= 98 ? 'Excellent' : stats.successRate >= 95 ? 'Good' : 'Needs attention'}` : undefined}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Method */}
        <select
          value={method}
          onChange={(e) => { setMethod(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Method: All</option>
          <option value="STRIPE">Stripe</option>
          <option value="PAYPAL">PayPal</option>
          <option value="GIFT_CARD">Gift Card</option>
          <option value="MIXED">Mixed</option>
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">Status: All</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
          <option value="PARTIALLY_REFUNDED">Partial Refund</option>
        </select>

        {/* Date range */}
        <select
          value={dateRange}
          onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {DATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order # or email…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {(method || status || dateRange) && (
          <button
            type="button"
            onClick={() => { setMethod(''); setStatus(''); setDateRange(''); setPage(1); }}
            className="flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Failed payments notice */}
      {status === 'FAILED' && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-button text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Showing failed payments — these orders may need manual follow-up.
        </div>
      )}

      {/* Table */}
      <DataTable
        data={payments}
        columns={columns}
        isLoading={listQuery.isLoading}
        pagination={{ page, limit: PAGE_SIZE, total, onPageChange: setPage }}
        onRowClick={(row) => setDrawer(row)}
        emptyTitle="No payments found"
        emptyDesc="Try adjusting your filters or search query."
      />

      {/* Detail drawer */}
      {drawer && (
        <PaymentDetailDrawer
          payment={drawer}
          onClose={() => setDrawer(null)}
          onRefund={() => setDrawer(null)}
        />
      )}
    </>
  );
}
