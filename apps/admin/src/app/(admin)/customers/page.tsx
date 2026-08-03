'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Search, Download, Users, UserPlus, RefreshCw,
  Eye, X, MapPin, TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { fmtDate, fmtNum, fmtAmount, fmtDateISO } from '../../../lib/fmt';
import { DataTable } from '../../../components/data/DataTable';
import { api, adminApi } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { FilterSelect } from '../../../components/ui/FilterSelect';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Customer {
  id:           string;
  firstName?:   string;
  lastName?:    string;
  email:        string;
  phone?:       string;
  country?:     string;
  city?:        string;
  ordersCount:  number;
  totalSpent:   number;
  lastOrderAt?: string;
  createdAt:    string;
  avatarUrl?:   string;
  tags?:        string[];
}

interface CustomerStats {
  total:          number;
  newThisMonth:   number;
  newLastMonth:   number;
  returningRate:  number;
}

// ── Mini stat card ────────────────────────────────────────────────────────────

function MiniStat({
  label, value, trend, icon: Icon, color = 'coral',
}: {
  label:  string;
  value:  string | number;
  trend?: { direction: 'up' | 'down'; text: string };
  icon:   React.ElementType;
  color?: 'coral' | 'blue' | 'green';
}) {
  const colorMap = {
    coral: { bg: 'bg-primary/10', text: 'text-primary' },
    blue:  { bg: 'bg-blue-50',    text: 'text-blue-500' },
    green: { bg: 'bg-green-50',   text: 'text-green-600' },
  };
  const c = colorMap[color];

  return (
    <div className="bg-surface rounded-card border border-border shadow-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-secondary tabular-nums leading-none">
          {typeof value === 'number' ? fmtNum(value) : value}
        </p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
      {trend && (
        <span className={`ml-auto flex items-center gap-1 text-xs font-semibold rounded-pill px-2 py-0.5 shrink-0 ${trend.direction === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
          <TrendingUp className="w-3 h-3" />
          {trend.text}
        </span>
      )}
    </div>
  );
}

// ── Avatar cell ───────────────────────────────────────────────────────────────

function CustomerAvatar({ customer }: { customer: Customer }) {
  const name     = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email;
  const initials = (customer.firstName?.[0] ?? '') + (customer.lastName?.[0] ?? '');
  const display  = initials.toUpperCase() || (customer.email[0]?.toUpperCase() ?? '?');

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0 border border-primary/20">
        {display}
      </div>
      <div className="min-w-0">
        <p className="font-medium text-secondary text-sm truncate max-w-[160px]">{name}</p>
        {customer.tags && customer.tags.length > 0 && (
          <span className="text-[10px] font-medium text-primary bg-primary/8 px-1.5 py-0.5 rounded-full">
            {customer.tags[0]}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Spent filter options ──────────────────────────────────────────────────────

const SPENT_OPTIONS = [
  { value: '',        label: 'All spend levels' },
  { value: '0-50',    label: 'Under $50'         },
  { value: '50-200',  label: '$50 – $200'        },
  { value: '200-500', label: '$200 – $500'       },
  { value: '500+',    label: '$500+'             },
];

const JOINED_OPTIONS = [
  { value: '',    label: 'All time'     },
  { value: '30',  label: 'Last 30 days' },
  { value: '90',  label: 'Last 3 months'},
  { value: '180', label: 'Last 6 months'},
  { value: '365', label: 'Last year'    },
];

const PAGE_SIZE = 15;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [country,    setCountry]    = useState('');
  const [joined,     setJoined]     = useState('');
  const [spent,      setSpent]      = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const statsQuery = useQuery<CustomerStats>({
    queryKey: ['admin-customer-stats'],
    queryFn:  () => api.get<CustomerStats>(API_ROUTES.ADMIN.CUSTOMERS_STATS),
    staleTime: 5 * 60_000,
  });

  const listQueryKey = ['admin-customers', page, debouncedQ, country, joined, spent];

  const listQuery = useQuery({
    queryKey: listQueryKey,
    queryFn:  async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedQ) p.set('q',       debouncedQ);
      if (country)    p.set('country', country);
      if (joined)     p.set('joinedDays', joined);
      if (spent)      p.set('spent',   spent);
      return api.get<{ data: Customer[]; total: number }>(`/admin/customers?${p}`);
    },
  });

  const customers = listQuery.data?.data ?? [];
  const total     = listQuery.data?.total ?? 0;
  const stats     = statsQuery.data;

  // ── Export CSV ───────────────────────────────────────────────────────────────

  const handleExport = async () => {
    const p = new URLSearchParams({ format: 'csv', limit: '10000' });
    if (debouncedQ) p.set('q',          debouncedQ);
    if (country)    p.set('country',    country);
    if (joined)     p.set('joinedDays', joined);
    if (spent)      p.set('spent',      spent);
    const res  = await adminApi.get(`/admin/customers/export?${p}`, { responseType: 'blob' });
    const blob = res.data as Blob;
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `customers-${fmtDateISO(new Date())}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<Customer>[]>(() => [
    {
      id:     'customer',
      header: 'Customer',
      size:   220,
      cell:   ({ row }) => <CustomerAvatar customer={row.original} />,
    },
    {
      accessorKey: 'email',
      header:      'Email',
      size:        220,
      cell:        ({ getValue }) => (
        <span className="text-sm text-muted font-mono truncate max-w-[200px] block">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'ordersCount',
      header:      'Orders',
      size:        80,
      enableSorting: true,
      cell:        ({ getValue }) => (
        <span className="text-sm font-semibold text-secondary tabular-nums">{getValue() as number}</span>
      ),
    },
    {
      accessorKey: 'totalSpent',
      header:      'Total Spent',
      size:        110,
      enableSorting: true,
      cell:        ({ getValue }) => (
        <span className="text-sm font-bold text-secondary tabular-nums">
          {fmtAmount(getValue() as number)}
        </span>
      ),
    },
    {
      id:     'location',
      header: 'Location',
      size:   140,
      cell:   ({ row }) => {
        const parts = [row.original.city, row.original.country].filter(Boolean).join(', ');
        return parts ? (
          <span className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="w-3 h-3 shrink-0" />{parts}
          </span>
        ) : <span className="text-muted">—</span>;
      },
    },
    {
      accessorKey: 'createdAt',
      header:      'Joined',
      size:        100,
      enableSorting: true,
      cell:        ({ getValue }) => (
        <span className="text-xs text-muted">{fmtDate(getValue() as string)}</span>
      ),
    },
    {
      accessorKey: 'lastOrderAt',
      header:      'Last Order',
      size:        100,
      cell:        ({ getValue }) => {
        const v = getValue() as string | undefined;
        return v
          ? <span className="text-xs text-muted">{fmtDate(v)}</span>
          : <span className="text-muted text-xs">—</span>;
      },
    },
    {
      id:   'actions',
      size: 80,
      header: '',
      cell: ({ row }) => (
        <Link
          href={`/customers/${row.original.id}`}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark px-2 py-1.5 rounded hover:bg-primary/5 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </Link>
      ),
    },
  ], []);

  // ── Render ───────────────────────────────────────────────────────────────────

  const trendPct = stats
    ? stats.newLastMonth > 0
      ? ((stats.newThisMonth - stats.newLastMonth) / stats.newLastMonth) * 100
      : 0
    : 0;

  return (
    <>
      <AdminPageHeader
        title="Customers"
        subtitle={`${fmtNum(total)} customers total`}
        queryKey={['admin-customers']}
      />

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MiniStat
          label="Total Customers"
          value={stats?.total ?? '—'}
          icon={Users}
          color="coral"
        />
        <MiniStat
          label="New This Month"
          value={stats?.newThisMonth ?? '—'}
          icon={UserPlus}
          color="blue"
          trend={stats ? { direction: trendPct >= 0 ? 'up' : 'down', text: `${Math.abs(trendPct).toFixed(0)}%` } : undefined}
        />
        <MiniStat
          label="Returning Rate"
          value={stats ? `${(stats.returningRate ?? 0).toFixed(0)}%` : '—'}
          icon={RefreshCw}
          color="green"
        />
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Country */}
        <FilterSelect
          value={country}
          onChange={(v) => { setCountry(v); setPage(1); }}
          options={[
            { value: '', label: 'All Countries' },
            ...['US','CA','GB','AU','DE','FR','JP','SG','VN'].map((c) => ({ value: c, label: c })),
          ]}
        />

        {/* Joined */}
        <FilterSelect
          value={joined}
          onChange={(v) => { setJoined(v); setPage(1); }}
          options={JOINED_OPTIONS.map((o) => ({ value: o.value, label: `Joined: ${o.label}` }))}
        />

        {/* Spent */}
        <FilterSelect
          value={spent}
          onChange={(v) => { setSpent(v); setPage(1); }}
          options={SPENT_OPTIONS.map((o) => ({ value: o.value, label: `Spent: ${o.label}` }))}
        />

        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Export */}
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted border border-border rounded-button bg-surface hover:border-primary/40 hover:text-primary transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <DataTable
        data={customers}
        columns={columns}
        isLoading={listQuery.isLoading}
        pagination={{
          page,
          limit:        PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
        emptyTitle="No customers found"
        emptyDesc="Try adjusting your filters or search query."
      />
    </>
  );
}
