'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Gift, Users, DollarSign, Clock, CheckCircle2, XCircle,
  AlertCircle, Loader2, Package, X, ExternalLink,
} from 'lucide-react';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { DataTable } from '../../../components/data/DataTable';
import { api } from '../../../lib/api-client';
import { fmtAmount, fmtDate, fmtDateTime } from '../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

type PoolStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

interface GiftPoolRow {
  id:              string;
  shareToken:      string;
  recipientName:   string;
  targetAmount:    number;
  collectedAmount: number;
  status:          PoolStatus;
  deadline:        string;
  createdAt:       string;
  contributions:   number;
  organizer:       { id: string; email: string };
  product:         { id: string; name: string; imageUrl: string | null } | null;
}

interface AdminGiftPoolStats {
  totalActive:    number;
  totalCompleted: number;
  totalExpired:   number;
  totalCancelled: number;
  totalCollected: number;
}

const PAGE_SIZE = 20;

const STATUS_CFG: Record<PoolStatus, { label: string; cls: string; dot?: boolean }> = {
  ACTIVE:    { label: 'Active',     cls: 'bg-primary/10 text-primary', dot: true },
  COMPLETED: { label: 'Completed',  cls: 'bg-green-100 text-green-700'            },
  EXPIRED:   { label: 'Expired',    cls: 'bg-amber-100 text-amber-700'            },
  CANCELLED: { label: 'Cancelled',  cls: 'bg-muted/10 text-muted'                 },
};

const TABS: { key: PoolStatus | 'ALL'; label: string }[] = [
  { key: 'ALL',       label: 'All Pools'  },
  { key: 'ACTIVE',    label: 'Active'     },
  { key: 'COMPLETED', label: 'Completed'  },
  { key: 'EXPIRED',   label: 'Expired'    },
  { key: 'CANCELLED', label: 'Cancelled'  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PoolStatus }) {
  const { label, cls, dot } = STATUS_CFG[status] ?? { label: status, cls: 'bg-muted/10 text-muted' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
      {label}
    </span>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, pct);
  return (
    <div className="w-full h-1.5 bg-border/30 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${clamped >= 100 ? 'bg-green-500' : 'bg-primary'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function MiniStat({
  label, value, icon: Icon, color = 'coral',
}: {
  label:  string;
  value:  string | number;
  icon:   React.ElementType;
  color?: 'coral' | 'blue' | 'amber' | 'green';
}) {
  const colorMap = {
    coral: { bg: 'bg-primary/10', text: 'text-primary'   },
    blue:  { bg: 'bg-blue-50',    text: 'text-blue-500'  },
    amber: { bg: 'bg-amber-50',   text: 'text-amber-600' },
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
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function PoolDetailPanel({
  pool,
  onClose,
  onClosePool,
  isClosing,
}: {
  pool:        GiftPoolRow;
  onClose:     () => void;
  onClosePool: (id: string) => void;
  isClosing:   boolean;
}) {
  const pct = pool.targetAmount > 0 ? (pool.collectedAmount / pool.targetAmount) * 100 : 0;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-surface border-l border-border shadow-2xl z-40 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h3 className="font-semibold text-secondary flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          Pool Detail
        </h3>
        <button type="button" onClick={onClose} className="text-muted hover:text-secondary">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-5 flex-1">
        {/* Product */}
        {pool.product && (
          <div className="rounded-card border border-border overflow-hidden">
            {pool.product.imageUrl ? (
              <img src={pool.product.imageUrl} alt={pool.product.name} className="w-full h-36 object-cover" />
            ) : (
              <div className="w-full h-36 bg-border/10 flex items-center justify-center">
                <Package className="w-10 h-10 text-muted/20" />
              </div>
            )}
            <div className="p-3">
              <p className="font-semibold text-secondary text-sm">{pool.product.name}</p>
            </div>
          </div>
        )}

        {/* Pool info */}
        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted">Recipient</p>
            <p className="font-semibold text-secondary text-sm mt-0.5">{pool.recipientName}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Organizer</p>
            <p className="text-sm text-secondary mt-0.5">{pool.organizer.email}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Progress</p>
            <div className="mt-1 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-secondary tabular-nums">{fmtAmount(pool.collectedAmount)}</span>
                <span className="text-muted tabular-nums">of {fmtAmount(pool.targetAmount)}</span>
              </div>
              <ProgressBar pct={pct} />
              <p className="text-xs text-muted">{Math.round(pct)}% funded · {pool.contributions} contributors</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted">Deadline</p>
              <p className="text-secondary mt-0.5">{fmtDate(pool.deadline)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Created</p>
              <p className="text-secondary mt-0.5">{fmtDate(pool.createdAt)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted">Status</p>
            <div className="mt-1">
              <StatusBadge status={pool.status} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted">Share link</p>
            <a
              href={`/gift/${pool.shareToken}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 mt-0.5 text-xs text-primary hover:underline"
            >
              /gift/{pool.shareToken} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {pool.status === 'ACTIVE' && (
        <div className="px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            disabled={isClosing}
            onClick={() => onClosePool(pool.id)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border-2 border-error text-error hover:bg-error/5 rounded-button transition-colors disabled:opacity-50"
          >
            {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Close Pool (Cancel)
          </button>
          <p className="text-[11px] text-muted text-center mt-2">
            This marks the pool as cancelled. Contributors should be refunded manually.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminGiftPoolsPage() {
  const qc = useQueryClient();

  const [tab,      setTab]      = useState<PoolStatus | 'ALL'>('ALL');
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<GiftPoolRow | null>(null);

  const statsQuery = useQuery<AdminGiftPoolStats>({
    queryKey: ['admin-gift-pools-stats'],
    queryFn:  () => api.get<AdminGiftPoolStats>('/admin/gift-pools/stats'),
    staleTime: 60_000,
  });
  const stats = statsQuery.data;

  const listQuery = useQuery<{ data: GiftPoolRow[]; total: number }>({
    queryKey: ['admin-gift-pools', tab, page],
    queryFn:  () =>
      api.get<{ data: GiftPoolRow[]; total: number }>('/admin/gift-pools', {
        params: {
          ...(tab !== 'ALL' && { status: tab }),
          page:  String(page),
          limit: String(PAGE_SIZE),
        },
      }),
  });

  const pools = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;

  const closeMutation = useMutation<void, Error, string>({
    mutationFn: (id) => api.patch(`/admin/gift-pools/${id}/close`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gift-pools'] });
      qc.invalidateQueries({ queryKey: ['admin-gift-pools-stats'] });
      setSelected(null);
    },
  });

  const columns = useMemo<ColumnDef<GiftPoolRow>[]>(() => [
    {
      id:     'pool',
      header: 'Pool',
      size:   230,
      cell:   ({ row }: { row: { original: GiftPoolRow } }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-3">
            {p.product?.imageUrl ? (
              <img src={p.product.imageUrl} alt={p.product.name} className="w-10 h-10 rounded-input object-cover border border-border shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-input bg-border/20 flex items-center justify-center shrink-0">
                <Gift className="w-5 h-5 text-muted/40" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-secondary line-clamp-1">For {p.recipientName}</p>
              <p className="text-xs text-muted line-clamp-1">{p.product?.name ?? '—'}</p>
            </div>
          </div>
        );
      },
    },
    {
      id:     'organizer',
      header: 'Organizer',
      size:   160,
      cell:   ({ row }: { row: { original: GiftPoolRow } }) =>
        <span className="text-xs text-secondary">{row.original.organizer.email}</span>,
    },
    {
      id:     'progress',
      header: 'Progress',
      size:   160,
      cell:   ({ row }: { row: { original: GiftPoolRow } }) => {
        const p = row.original;
        const pct = p.targetAmount > 0 ? (p.collectedAmount / p.targetAmount) * 100 : 0;
        return (
          <div className="min-w-0">
            <div className="flex justify-between text-xs text-secondary tabular-nums mb-1">
              <span className="font-semibold">{fmtAmount(p.collectedAmount)}</span>
              <span className="text-muted">/ {fmtAmount(p.targetAmount)}</span>
            </div>
            <ProgressBar pct={pct} />
          </div>
        );
      },
    },
    {
      id:     'contributors',
      header: 'Contributors',
      size:   100,
      cell:   ({ row }: { row: { original: GiftPoolRow } }) => (
        <span className="flex items-center gap-1 text-sm text-secondary tabular-nums">
          <Users className="w-3.5 h-3.5 text-muted" />
          {row.original.contributions}
        </span>
      ),
    },
    {
      id:     'deadline',
      header: 'Deadline',
      size:   110,
      cell:   ({ row }: { row: { original: GiftPoolRow } }) => (
        <span className="flex items-center gap-1 text-xs text-muted">
          <Clock className="w-3 h-3 shrink-0" />
          {fmtDate(row.original.deadline)}
        </span>
      ),
    },
    {
      id:     'status',
      header: 'Status',
      size:   120,
      cell:   ({ row }: { row: { original: GiftPoolRow } }) =>
        <StatusBadge status={row.original.status} />,
    },
    {
      id:   'actions',
      size: 80,
      header: '',
      cell: ({ row }: { row: { original: GiftPoolRow } }) => (
        <button
          type="button"
          onClick={() => setSelected(row.original)}
          className="px-3 py-1.5 text-xs font-semibold border border-border text-muted hover:text-secondary hover:border-border/70 rounded-button transition-colors"
        >
          View
        </button>
      ),
    },
  ], []);

  return (
    <>
      <AdminPageHeader
        title="Gift Pools"
        subtitle={`${total} pool${total !== 1 ? 's' : ''} · ${tab === 'ALL' ? 'all statuses' : tab.toLowerCase()}`}
        queryKey={['admin-gift-pools']}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <MiniStat label="Active Pools"     value={stats?.totalActive    ?? '—'} icon={Gift}         color="coral"  />
        <MiniStat label="Completed"        value={stats?.totalCompleted ?? '—'} icon={CheckCircle2} color="green"  />
        <MiniStat label="Expired"          value={stats?.totalExpired   ?? '—'} icon={Clock}        color="amber"  />
        <MiniStat label="Cancelled"        value={stats?.totalCancelled ?? '—'} icon={AlertCircle}  color="blue"   />
        <MiniStat
          label="Total Collected"
          value={stats ? fmtAmount(stats.totalCollected) : '—'}
          icon={DollarSign}
          color="green"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-5 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setPage(1); setSelected(null); }}
            className={[
              'shrink-0 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === key
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted hover:text-secondary',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={selected ? 'pr-[26rem]' : ''}>
        <DataTable
          data={pools}
          columns={columns}
          isLoading={listQuery.isLoading}
          pagination={{ page, limit: PAGE_SIZE, total, onPageChange: setPage }}
          emptyTitle="No gift pools found"
          emptyDesc="Gift pools in this status will appear here."
        />
      </div>

      {selected && (
        <PoolDetailPanel
          pool={selected}
          onClose={() => setSelected(null)}
          onClosePool={(id) => closeMutation.mutate(id)}
          isClosing={closeMutation.isPending}
        />
      )}
    </>
  );
}
