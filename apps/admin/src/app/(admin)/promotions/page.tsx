'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Plus, Search, X, Tag, TrendingDown, Activity, Zap,
  Copy, Pause, Play, Trash2, BarChart2, Pencil,
} from 'lucide-react';
import { format } from 'date-fns';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { DataTable } from '../../../components/data/DataTable';
import { PromotionModal, type Promotion, type PromotionFormData } from '../../../components/promotions/PromotionModal';
import { PromotionStatsDrawer } from '../../../components/promotions/PromotionStatsDrawer';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount } from '../../../lib/fmt';

// ── Status helpers ────────────────────────────────────────────────────────────

type PromotionStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'SCHEDULED';

function getStatus(p: Promotion): PromotionStatus {
  const now = new Date();
  if (p.expiresAt && new Date(p.expiresAt) < now)  return 'EXPIRED';
  if (!p.isActive)                                   return 'PAUSED';
  if (p.startsAt && new Date(p.startsAt) > now)     return 'SCHEDULED';
  return 'ACTIVE';
}

const STATUS_CFG: Record<PromotionStatus, { label: string; cls: string }> = {
  ACTIVE:    { label: 'Active',    cls: 'bg-green-100 text-green-700'  },
  PAUSED:    { label: 'Paused',    cls: 'bg-amber-100 text-amber-700'  },
  EXPIRED:   { label: 'Expired',   cls: 'bg-red-100 text-red-700'      },
  SCHEDULED: { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700'    },
};

function StatusBadge({ status }: { status: PromotionStatus }) {
  const { label, cls } = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {label}
    </span>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PERCENTAGE:    { label: '%',          cls: 'bg-purple-50 text-purple-700' },
    FIXED_AMOUNT:  { label: '$ Fixed',    cls: 'bg-blue-50 text-blue-700'     },
    FREE_SHIPPING: { label: '🚚 Ship',    cls: 'bg-teal-50 text-teal-700'     },
  };
  const cfg = map[type] ?? { label: type, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-pill ${cfg.cls}`}>{cfg.label}</span>
  );
}

// ── Mini stat card ────────────────────────────────────────────────────────────

function MiniStat({
  label, value, icon: Icon, color = 'coral',
}: {
  label:  string;
  value:  string | number;
  icon:   React.ElementType;
  color?: 'coral' | 'blue' | 'green' | 'amber';
}) {
  const colorMap = {
    coral: { bg: 'bg-primary/10', text: 'text-primary'   },
    blue:  { bg: 'bg-blue-50',    text: 'text-blue-500'  },
    green: { bg: 'bg-green-50',   text: 'text-green-600' },
    amber: { bg: 'bg-amber-50',   text: 'text-amber-600' },
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

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon, label, onClick, variant = 'ghost',
}: {
  icon:     React.ElementType;
  label:    string;
  onClick:  (e: React.MouseEvent) => void;
  variant?: 'ghost' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={[
        'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
        variant === 'danger'
          ? 'text-red-500 hover:bg-red-50'
          : 'text-muted hover:text-primary hover:bg-primary/5',
      ].join(' ')}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

// ── Stats interface ───────────────────────────────────────────────────────────

interface PromotionStats {
  activeCoupons:       number;
  usedToday:           number;
  revenueDiscounted:   number;
  avgDiscountValue:    number;
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function PromotionsPage() {
  const qc = useQueryClient();

  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [typeF,    setTypeF]    = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [modal,    setModal]    = useState<Promotion | null | 'new'>(null);
  const [statsFor, setStatsFor] = useState<Promotion | null>(null);

  // ── Stats query ───────────────────────────────────────────────────────────────
  const statsQuery = useQuery<PromotionStats>({
    queryKey: ['promo-page-stats'],
    queryFn:  () => api.get<PromotionStats>(API_ROUTES.ADMIN.PROMOTIONS_PAGE_STATS),
    staleTime: 60_000,
  });
  const stats = statsQuery.data;

  // ── List query ────────────────────────────────────────────────────────────────
  const listKey = ['admin-promotions', page, search, typeF, statusF];
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn:  async () => {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (search)  params['q']      = search;
      if (typeF)   params['type']   = typeF;
      if (statusF) params['status'] = statusF;
      return api.get<{ data: Promotion[]; total: number }>(API_ROUTES.ADMIN.PROMOTIONS, { params });
    },
  });

  const promotions = listQuery.data?.data ?? [];
  const total      = listQuery.data?.total ?? 0;

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-promotions'] });
    qc.invalidateQueries({ queryKey: ['promo-page-stats'] });
  };

  const handleToggleActive = async (p: Promotion, active: boolean) => {
    await api.patch(API_ROUTES.ADMIN.PROMOTION(p.id), { isActive: active });
    invalidate();
  };

  const handleDelete = async (p: Promotion) => {
    if (!confirm(`Delete coupon "${p.code}"? This cannot be undone.`)) return;
    await api.delete(API_ROUTES.ADMIN.PROMOTION(p.id));
    invalidate();
  };

  const handleDuplicate = async (p: Promotion) => {
    const code = `${p.code.replace(/-COPY\d*$/, '')}-COPY${Date.now().toString().slice(-4)}`;
    await api.post(API_ROUTES.ADMIN.PROMOTIONS, { ...p, id: undefined, code, currentUses: 0, isActive: false });
    invalidate();
  };

  const handleSave = async (data: PromotionFormData, id?: string) => {
    if (id) {
      await api.patch(API_ROUTES.ADMIN.PROMOTION(id), data);
    } else {
      await api.post(API_ROUTES.ADMIN.PROMOTIONS, data);
    }
    invalidate();
    setModal(null);
  };

  // ── Columns ───────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<Promotion>[]>(() => [
    {
      id:     'code',
      header: 'Code',
      size:   160,
      cell:   ({ row }: { row: { original: Promotion } }) => (
        <div>
          <button
            type="button"
            onClick={() => setStatsFor(row.original)}
            className="font-mono font-bold text-sm tracking-widest text-primary hover:underline"
          >
            {row.original.code}
          </button>
          {row.original.description && (
            <p className="text-[11px] text-muted truncate max-w-[140px] mt-0.5 italic">{row.original.description}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header:      'Type',
      size:        100,
      cell:        ({ getValue }: { getValue: () => unknown }) => <TypeBadge type={getValue() as string} />,
    },
    {
      id:     'value',
      header: 'Value',
      size:   90,
      cell:   ({ row }: { row: { original: Promotion } }) => {
        const { type, value } = row.original;
        if (type === 'FREE_SHIPPING') return <span className="text-sm text-teal-600 font-semibold">Free</span>;
        if (type === 'PERCENTAGE')    return <span className="text-sm font-semibold text-secondary">{value}%</span>;
        return <span className="text-sm font-semibold text-secondary">{fmtAmount(Number(value) || 0)}</span>;
      },
    },
    {
      id:     'minOrder',
      header: 'Min Order',
      size:   100,
      cell:   ({ row }: { row: { original: Promotion } }) =>
        row.original.minOrderAmount
          ? <span className="text-sm text-muted">{fmtAmount(Number(row.original.minOrderAmount) || 0)}</span>
          : <span className="text-muted text-xs">—</span>,
    },
    {
      id:     'uses',
      header: 'Uses / Max',
      size:   100,
      cell:   ({ row }: { row: { original: Promotion } }) => {
        const { currentUses, maxUses } = row.original;
        const pct = maxUses ? (currentUses / maxUses) * 100 : 0;
        return (
          <div>
            <span className="text-sm text-secondary tabular-nums font-medium">
              {currentUses} / {maxUses ?? '∞'}
            </span>
            {maxUses && (
              <div className="w-full h-1 bg-border rounded-full mt-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-400' : pct > 60 ? 'bg-amber-400' : 'bg-primary'}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      },
    },
    {
      id:     'expires',
      header: 'Expires',
      size:   110,
      cell:   ({ row }: { row: { original: Promotion } }) =>
        row.original.expiresAt
          ? <span className="text-xs text-muted">{format(new Date(row.original.expiresAt), 'MMM d, yyyy')}</span>
          : <span className="text-xs text-muted italic">Never</span>,
    },
    {
      id:     'status',
      header: 'Status',
      size:   100,
      cell:   ({ row }: { row: { original: Promotion } }) => <StatusBadge status={getStatus(row.original)} />,
    },
    {
      id:   'actions',
      size: 180,
      header: '',
      cell: ({ row }: { row: { original: Promotion } }) => {
        const p = row.original;
        const status = getStatus(p);
        return (
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <ActionBtn icon={BarChart2} label="Stats"     onClick={() => setStatsFor(p)} />
            {status !== 'EXPIRED' && (
              <ActionBtn icon={Pencil}   label="Edit"      onClick={() => setModal(p)} />
            )}
            {status === 'ACTIVE' && (
              <ActionBtn icon={Pause}  label="Pause"   onClick={() => handleToggleActive(p, false)} />
            )}
            {status === 'PAUSED' && (
              <ActionBtn icon={Play}   label="Resume"  onClick={() => handleToggleActive(p, true)} />
            )}
            <ActionBtn icon={Copy}    label="Duplicate" onClick={() => handleDuplicate(p)} />
            {status !== 'EXPIRED' && (
              <ActionBtn icon={Trash2} label="Delete"  onClick={() => handleDelete(p)} variant="danger" />
            )}
          </div>
        );
      },
    },
  ], []);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminPageHeader
        title="Promotions"
        subtitle={`${total} coupon${total !== 1 ? 's' : ''} total`}
        actions={
          <button
            type="button"
            onClick={() => setModal('new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Promotion
          </button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MiniStat
          label="Active Coupons"
          value={stats?.activeCoupons ?? '—'}
          icon={Tag}
          color="coral"
        />
        <MiniStat
          label="Used Today"
          value={stats?.usedToday ?? '—'}
          icon={Activity}
          color="blue"
        />
        <MiniStat
          label="Revenue Discounted"
          value={stats ? fmtAmount(stats.revenueDiscounted) : '—'}
          icon={TrendingDown}
          color="amber"
        />
        <MiniStat
          label="Avg Discount Value"
          value={stats ? fmtAmount(stats.avgDiscountValue) : '—'}
          icon={Zap}
          color="green"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search coupon code…"
            className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Type filter */}
        <select
          value={typeF}
          onChange={(e) => { setTypeF(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All types</option>
          <option value="PERCENTAGE">% Percentage</option>
          <option value="FIXED_AMOUNT">$ Fixed Amount</option>
          <option value="FREE_SHIPPING">Free Shipping</option>
        </select>

        {/* Status filter */}
        <select
          value={statusF}
          onChange={(e) => { setStatusF(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="EXPIRED">Expired</option>
          <option value="SCHEDULED">Scheduled</option>
        </select>

        {(search || typeF || statusF) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setTypeF(''); setStatusF(''); setPage(1); }}
            className="flex items-center gap-1 text-xs text-muted hover:text-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable
        data={promotions}
        columns={columns}
        isLoading={listQuery.isLoading}
        pagination={{ page, limit: PAGE_SIZE, total, onPageChange: setPage }}
        emptyTitle="No promotions found"
        emptyDesc="Create your first coupon code to get started."
      />

      {/* Create / Edit modal */}
      {modal !== null && (
        <PromotionModal
          promotion={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Stats drawer */}
      {statsFor && (
        <PromotionStatsDrawer
          promotion={statsFor}
          onClose={() => setStatsFor(null)}
        />
      )}
    </>
  );
}
