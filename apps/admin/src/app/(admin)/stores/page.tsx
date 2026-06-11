'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { ColumnDef } from '@tanstack/react-table';
import { Search, Store } from 'lucide-react';
import { DataTable } from '../../../components/data/DataTable';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreRow {
  id:           string;
  name:         string;
  slug:         string;
  status:       string;
  planType:     string;
  totalOrders:  number;
  totalRevenue: number;
  createdAt:    string;
  owner: {
    firstName: string | null;
    lastName:  string | null;
    email:     string;
  };
}

interface StoresResponse {
  data:       StoreRow[];
  pagination: { total: number; page: number; totalPages: number };
}

const STATUS_OPTIONS = ['', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'];

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  ACTIVE:    'bg-green-100 text-green-700',
  SUSPENDED: 'bg-orange-100 text-orange-700',
  REJECTED:  'bg-red-100 text-red-700',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminStoresPage() {
  const qc = useQueryClient();
  const [page,   setPage  ] = useState(1);
  const [status, setStatus] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [debSearch, setDebSearch] = useState('');
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebSearch(search), 300);
    return () => clearTimeout(debRef.current);
  }, [search]);

  const { data, isLoading } = useQuery<StoresResponse>({
    queryKey: ['admin-stores', page, status, debSearch],
    queryFn:  () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (status)    p.set('status', status);
      if (debSearch) p.set('search', debSearch);
      return api.get<StoresResponse>(`${API_ROUTES.ADMIN.STORES}?${p}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(API_ROUTES.ADMIN.STORE_APPROVE(id), {}),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-stores'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(API_ROUTES.ADMIN.STORE_REJECT(id), { reason }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-stores'] }),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(API_ROUTES.ADMIN.STORE_SUSPEND(id), { reason }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin-stores'] }),
  });

  const stores     = data?.data ?? [];
  const pagination = data?.pagination;

  const columns: ColumnDef<StoreRow>[] = [
    {
      accessorKey: 'name',
      header:      'Store',
      cell:        ({ row }) => (
        <a href={`/stores/${row.original.id}`} className="block group">
          <p className="font-medium text-secondary group-hover:text-primary transition-colors">{row.original.name}</p>
          <p className="text-xs text-muted font-mono">/shops/{row.original.slug}</p>
        </a>
      ),
    },
    {
      id:      'owner',
      header:  'Owner',
      cell:    ({ row }) => {
        const o = row.original.owner;
        const name = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email;
        return (
          <div>
            <p className="text-sm text-secondary">{name}</p>
            <p className="text-xs text-muted">{o.email}</p>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header:      'Status',
      cell:        ({ row }) => (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[row.original.status] ?? 'bg-muted/10 text-muted'}`}>
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'planType',
      header:      'Plan',
      cell:        ({ row }) => <span className="text-xs text-muted">{row.original.planType}</span>,
    },
    {
      accessorKey: 'totalOrders',
      header:      'Orders',
      cell:        ({ row }) => <span className="text-sm text-secondary tabular-nums">{row.original.totalOrders}</span>,
    },
    {
      accessorKey: 'createdAt',
      header:      'Applied',
      cell:        ({ row }) => (
        <span className="text-xs text-muted whitespace-nowrap">
          {format(new Date(row.original.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      id:     'actions',
      header: '',
      size:   220,
      cell:   ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center gap-2">
            <a href={`/stores/${s.id}`}
              className="text-xs font-medium text-secondary border border-border px-3 py-1 rounded-button hover:border-primary hover:text-primary transition-colors">
              View
            </a>
            {s.status === 'PENDING' && (
              <>
                <button
                  type="button"
                  onClick={() => approveMutation.mutate(s.id)}
                  className="text-xs font-medium text-white bg-green-600 px-3 py-1 rounded-button hover:bg-green-700 transition-colors"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const reason = prompt('Rejection reason:');
                    if (reason) rejectMutation.mutate({ id: s.id, reason });
                  }}
                  className="text-xs font-medium text-white bg-error px-3 py-1 rounded-button hover:opacity-80 transition-colors"
                >
                  Reject
                </button>
              </>
            )}
            {s.status === 'ACTIVE' && (
              <button
                type="button"
                onClick={() => {
                  const reason = prompt('Suspension reason:');
                  if (reason) suspendMutation.mutate({ id: s.id, reason });
                }}
                className="text-xs font-medium text-secondary border border-border px-3 py-1 rounded-button hover:border-error hover:text-error transition-colors"
              >
                Suspend
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Stores"
        subtitle="Manage seller stores and applications"
        queryKey={['admin-stores']}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search stores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-border rounded-button focus:outline-none focus:border-primary transition-colors"
          />
        </div>
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
        data={stores}
        isLoading={isLoading}
        pagination={pagination ? {
          page:         pagination.page,
          limit:        20,
          total:        pagination.total,
          onPageChange: setPage,
        } : undefined}
        emptyTitle="No stores found"
        emptyDesc="Stores will appear here once sellers apply."
      />
    </div>
  );
}
