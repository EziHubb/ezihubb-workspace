'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../../../components/data/DataTable';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount } from '../../../lib/fmt';

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

const STATUS_OPTIONS = ['', 'PENDING', 'PROCESSING', 'PAID', 'FAILED'];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPayoutsPage() {
  const qc = useQueryClient();
  const [page,   setPage  ] = useState(1);
  const [status, setStatus] = useState('PENDING');

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
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
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
              Paid {row.original.paidAt ? format(new Date(row.original.paidAt), 'MMM d') : ''}
              {row.original.paymentMethod ? ` via ${row.original.paymentMethod}` : ''}
            </span>
          );
        }
        if (row.original.status === 'PENDING' || row.original.status === 'PROCESSING') {
          return (
            <button
              type="button"
              disabled={payMutation.isPending}
              onClick={() => {
                const method = prompt('Payment method (e.g. Bank Transfer, PayPal):');
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
      <AdminPageHeader
        title="Seller Payouts"
        subtitle="Manage and process seller payout disbursements"
        queryKey={['admin-seller-payouts']}
      />

      {/* Status filter */}
      <div className="mb-6">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="text-sm border border-border rounded-button px-3 py-2 focus:outline-none focus:border-primary transition-colors"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || 'All Statuses'}</option>
          ))}
        </select>
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
