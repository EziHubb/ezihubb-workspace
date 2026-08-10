'use client';

import { useState, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Clock, DollarSign, CheckCircle2, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';
import { DataTable } from '../../../components/data/DataTable';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtDate, capitalize } from '../../../lib/fmt';
import { useDialog } from '../../../contexts/DialogContext';
import { FilterSelect, type FilterOption } from '../../../components/ui/FilterSelect';

interface PayoutStats {
  pendingCount:      number;
  pendingAmount:     number;
  processingCount:   number;
  processingAmount:  number;
  paidThisMonth:     number;
  failedCount:       number;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PayoutRow {
  id:            string;
  period:        string;
  amount:        number;
  platformFee:   number;
  orderCount:    number;
  status:        'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  paidAt:        string | null;
  paymentMethod: string | null;
  createdAt:     string;
  store: {
    name: string;
    slug: string;
  };
}

interface PayoutsResponse {
  data:       PayoutRow[];
  pagination: { total: number; page: number; totalPages: number };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-amber-100 text-amber-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  PAID:       'bg-green-100 text-green-700',
  FAILED:     'bg-red-100 text-red-700',
};

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { value: '',           label: 'All Statuses' },
  { value: 'PENDING',    label: capitalize('PENDING'),    icon: <Clock className="w-3.5 h-3.5 text-amber-500" /> },
  { value: 'PROCESSING', label: capitalize('PROCESSING'), icon: <RefreshCw className="w-3.5 h-3.5 text-blue-500" /> },
  { value: 'PAID',       label: capitalize('PAID'),       icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> },
  { value: 'FAILED',     label: capitalize('FAILED'),     icon: <XCircle className="w-3.5 h-3.5 text-red-500" /> },
];

// ── Inner page (needs useSearchParams) ───────────────────────────────────────

function AdminPayoutsPageInner() {
  const qc = useQueryClient();
  const { prompt } = useDialog();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter lives on the URL (?status=), not local state — shareable/bookmarkable
  // and survives a refresh. Defaults to Pending, matching prior behavior.
  const status = searchParams.get('status') ?? 'PENDING';
  const setStatus = (v: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (v) params.set('status', v);
    else params.delete('status');
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const [page, setPage] = useState(1);

  const { data: payoutStats } = useQuery<PayoutStats>({
    queryKey: ['admin-payout-stats'],
    queryFn:  () => api.get<PayoutStats>(API_ROUTES.ADMIN.SELLER_PAYOUTS_STATS),
    staleTime: 60_000,
  });

  const { data, isLoading } = useQuery<PayoutsResponse>({
    queryKey: ['admin-seller-payouts', page, status],
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (status) p.set('status', status);
      return api.get<PayoutsResponse>(`${API_ROUTES.ADMIN.SELLER_PAYOUTS}?${p}`);
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ id, method }: { id: string; method: string }) =>
      api.post(API_ROUTES.ADMIN.SELLER_PAYOUT_PAY(id), { paymentMethod: method }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-seller-payouts'] }),
  });

  const payouts    = data?.data ?? [];
  const pagination = data?.pagination;

  const columns: ColumnDef<PayoutRow>[] = [
    {
      id:      'store',
      header:  'Store',
      cell:    ({ row }) => (
        <div>
          <p className="font-medium text-secondary">{row.original.store.name}</p>
          <p className="text-xs text-muted">/shops/{row.original.store.slug}</p>
        </div>
      ),
    },
    {
      accessorKey: 'period',
      header:      'Period',
      cell:        ({ row }) => <span className="text-sm text-secondary">{row.original.period}</span>,
    },
    {
      accessorKey: 'orderCount',
      header:      'Orders',
      cell:        ({ row }) => <span className="text-sm text-muted tabular-nums">{row.original.orderCount}</span>,
    },
    {
      accessorKey: 'amount',
      header:      'Amount',
      cell:        ({ row }) => (
        <span className="text-sm font-semibold text-secondary tabular-nums">
          {fmtAmount(row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header:      'Status',
      cell:        ({ row }) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[row.original.status]}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header:      'Created',
      cell:        ({ row }) => (
        <span className="text-xs text-muted">
          {fmtDate(row.original.createdAt)}
        </span>
      ),
    },
    {
      id:     'actions',
      header: '',
      size:   140,
      cell:   ({ row }) => {
        if (row.original.status === 'PAID') {
          return (
            <span className="text-xs text-muted">
              Paid {row.original.paidAt ? fmtDate(row.original.paidAt) : ''}
              {row.original.paymentMethod ? ` via ${row.original.paymentMethod}` : ''}
            </span>
          );
        }
        if (row.original.status === 'PENDING' || row.original.status === 'PROCESSING') {
          return (
            <button
              type="button"
              disabled={payMutation.isPending}
              onClick={async () => {
                const method = await prompt('Payment method', { placeholder: 'e.g. Bank Transfer, PayPal', title: 'Process Payout' });
                if (method) payMutation.mutate({ id: row.original.id, method });
              }}
              className="text-xs font-medium text-white bg-green-600 px-3 py-1 rounded-button hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Mark Paid
            </button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div>
      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Clock,         label: 'Pending',        value: fmtAmount(payoutStats?.pendingAmount     ?? 0), sub: `${payoutStats?.pendingCount     ?? 0} payouts`, color: 'bg-amber-500' },
          { icon: AlertTriangle, label: 'Processing',     value: fmtAmount(payoutStats?.processingAmount  ?? 0), sub: `${payoutStats?.processingCount  ?? 0} payouts`, color: 'bg-blue-500' },
          { icon: CheckCircle2,  label: 'Paid This Month',value: fmtAmount(payoutStats?.paidThisMonth     ?? 0), sub: 'completed',                                      color: 'bg-green-500' },
          { icon: DollarSign,    label: 'Failed',         value: String(payoutStats?.failedCount ?? 0),          sub: 'need attention',                                  color: 'bg-red-500' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted font-medium">{label}</p>
              <p className="text-lg font-bold text-secondary tabular-nums">{value}</p>
              <p className="text-xs text-muted">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="mb-6">
        <FilterSelect
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          options={STATUS_FILTER_OPTIONS}
        />
      </div>

      <DataTable
        columns={columns}
        data={payouts}
        isLoading={isLoading}
        pagination={pagination ? {
          page:         pagination.page,
          limit:        20,
          total:        pagination.total,
          onPageChange: setPage,
        } : undefined}
        emptyTitle="No payouts found"
        emptyDesc="Seller payouts will appear here once generated."
      />
    </div>
  );
}

// ── Page wrapper (Suspense boundary for useSearchParams) ─────────────────────

export default function AdminPayoutsPage() {
  return (
    <>
      <AdminPageHeader
        title="Seller Payouts"
        subtitle="Manage and process seller payout disbursements"
        queryKey={['admin-seller-payouts']}
      />
      <Suspense fallback={<div className="animate-pulse h-96 bg-muted/5 rounded-xl" />}>
        <AdminPayoutsPageInner />
      </Suspense>
    </>
  );
}
