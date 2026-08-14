'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Plus, Search, X, Tag, TrendingDown, Activity, Zap,
  Copy, Pause, Play, Trash2, BarChart2, Pencil, Sparkles, Users, Package, Target,
} from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { DataTable } from '../../../../components/data/DataTable';
import { PromotionModal, type Promotion, type PromotionFormData } from '../../../../components/promotions/PromotionModal';
import { PromotionStatsDrawer } from '../../../../components/promotions/PromotionStatsDrawer';
import { SetUpSaleModal, type SaleFormData } from '../../../../components/marketing/SetUpSaleModal';
import { BuyTogetherModal, type BundleFormData, type BundleOffer } from '../../../../components/marketing/BuyTogetherModal';
import { TargetedOffersModal } from '../../../../components/marketing/TargetedOffersModal';
import { BuyerOffersPanel } from '../../../../components/marketing/BuyerOffersPanel';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtDate, fmtNum } from '../../../../lib/fmt';
import { useDialog } from '../../../../contexts/DialogContext';
import { FilterSelect } from '../../../../components/ui/FilterSelect';
import { useAdminMode } from '../../../../lib/store-context';

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

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PERCENTAGE:    { label: '%',          cls: 'bg-purple-50 text-purple-700' },
    FIXED_AMOUNT:  { label: '$ Fixed',    cls: 'bg-blue-50 text-blue-700'     },
    FREE_SHIPPING: { label: '🚚 Ship',    cls: 'bg-teal-50 text-teal-700'     },
  };
  const cfg = map[type] ?? { label: type, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-pill ${cfg.cls}`}>{cfg.label}</span>;
}

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
          {typeof value === 'number' ? fmtNum(value) : value}
        </p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

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

interface PromotionStats {
  activeCoupons:       number;
  usedToday:           number;
  revenueDiscounted:   number;
  avgDiscountValue:    number;
}

const PAGE_SIZE = 20;

export default function MarketingSalesPage() {
  const qc = useQueryClient();
  const { confirm } = useDialog();
  const { isPlatformContext } = useAdminMode();

  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [typeF,    setTypeF]    = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [couponModal, setCouponModal] = useState<Promotion | null | 'new'>(null);
  const [saleModal,   setSaleModal]   = useState<Promotion | null | 'new'>(null);
  const [statsFor, setStatsFor] = useState<Promotion | null>(null);

  const [bundleModal, setBundleModal] = useState<BundleOffer | null | 'new'>(null);
  const [targetedOffersOpen, setTargetedOffersOpen] = useState(false);

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

  // ── Bundle offers query ──────────────────────────────────────────────────────
  const bundlesQuery = useQuery({
    queryKey: ['admin-bundle-offers'],
    queryFn:  () => api.get<BundleOffer[]>(API_ROUTES.ADMIN.BUNDLE_OFFERS),
  });
  const bundles = bundlesQuery.data ?? [];

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
    const label = p.code ?? p.description ?? 'this sale';
    if (!await confirm(`Delete "${label}"? This cannot be undone.`, { confirmLabel: 'Delete', destructive: true })) return;
    await api.delete(API_ROUTES.ADMIN.PROMOTION(p.id));
    invalidate();
  };

  const handleDuplicate = async (p: Promotion) => {
    if (!p.code) return; // sales have no code to duplicate from
    const code = `${p.code.replace(/-COPY\d*$/, '')}-COPY${Date.now().toString().slice(-4)}`;
    await api.post(API_ROUTES.ADMIN.PROMOTIONS, {
      ...p, id: undefined, code, currentUses: 0, isActive: false, store: undefined, storeId: p.store?.id,
    });
    invalidate();
  };

  const handleSaveCoupon = async (data: PromotionFormData, id?: string, storeId?: string) => {
    if (id) {
      await api.patch(API_ROUTES.ADMIN.PROMOTION(id), data);
    } else {
      await api.post(API_ROUTES.ADMIN.PROMOTIONS, { ...data, storeId });
    }
    invalidate();
    setCouponModal(null);
  };

  const handleSaveSale = async (data: SaleFormData, id?: string) => {
    const payload = {
      description:        data.description,
      type:                'PERCENTAGE',
      value:               data.value,
      autoApply:           true,
      scope:               data.scope,
      productIds:          data.scope === 'SPECIFIC_LISTINGS' ? data.productIds : undefined,
      country:             data.country || undefined,
      startsAt:            data.startsAt || undefined,
      expiresAt:           data.expiresAt || undefined,
      termsAndConditions:  data.termsAndConditions || undefined,
    };
    if (id) {
      await api.patch(API_ROUTES.ADMIN.PROMOTION(id), payload);
    } else {
      await api.post(API_ROUTES.ADMIN.PROMOTIONS, payload);
    }
    invalidate();
    setSaleModal(null);
  };

  const handleSaveBundle = async (data: BundleFormData, id?: string) => {
    if (id) {
      await api.patch(API_ROUTES.ADMIN.BUNDLE_OFFER(id), data);
    } else {
      await api.post(API_ROUTES.ADMIN.BUNDLE_OFFERS, data);
    }
    qc.invalidateQueries({ queryKey: ['admin-bundle-offers'] });
    setBundleModal(null);
  };

  const handleDeleteBundle = async (b: BundleOffer) => {
    if (!await confirm('Delete this bundle offer? This cannot be undone.', { confirmLabel: 'Delete', destructive: true })) return;
    await api.delete(API_ROUTES.ADMIN.BUNDLE_OFFER(b.id));
    qc.invalidateQueries({ queryKey: ['admin-bundle-offers'] });
  };

  const handleToggleBundle = async (b: BundleOffer, active: boolean) => {
    await api.patch(API_ROUTES.ADMIN.BUNDLE_OFFER(b.id), { isActive: active });
    qc.invalidateQueries({ queryKey: ['admin-bundle-offers'] });
  };

  // ── Columns ───────────────────────────────────────────────────────────────────

  const columns = useMemo<ColumnDef<Promotion>[]>(() => [
    {
      id:     'code',
      header: 'Code / Sale',
      size:   180,
      cell:   ({ row }: { row: { original: Promotion } }) => (
        <div>
          <button
            type="button"
            onClick={() => setStatsFor(row.original)}
            className="font-mono font-bold text-sm tracking-widest text-primary hover:underline"
          >
            {row.original.code ?? (
              <span className="inline-flex items-center gap-1 font-sans font-semibold normal-case tracking-normal">
                <Sparkles className="w-3 h-3" /> Auto-applied sale
              </span>
            )}
          </button>
          {row.original.description && (
            <p className="text-[11px] text-muted truncate max-w-[160px] mt-0.5 italic">{row.original.description}</p>
          )}
          {row.original.autoApply && (
            <span className="inline-block text-[10px] text-muted mt-0.5">
              {row.original.scope === 'SPECIFIC_LISTINGS' ? `${row.original.productIds?.length ?? 0} listing(s)` : 'All listings'}
            </span>
          )}
        </div>
      ),
    },
    ...(isPlatformContext ? [{
      id:     'store',
      header: 'Store',
      size:   130,
      cell:   ({ row }: { row: { original: Promotion } }) =>
        row.original.store
          ? <span className="text-sm text-secondary truncate">{row.original.store.name}</span>
          : <span className="text-xs text-muted italic">Platform-wide</span>,
    } as ColumnDef<Promotion>] : []),
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
      id:     'uses',
      header: 'Uses',
      size:   100,
      cell:   ({ row }: { row: { original: Promotion } }) => {
        const { currentUses, maxUses, autoApply } = row.original;
        if (autoApply) return <span className="text-xs text-muted italic">—</span>;
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
          ? <span className="text-xs text-muted">{fmtDate(row.original.expiresAt)}</span>
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
            <ActionBtn icon={BarChart2} label="Stats" onClick={() => setStatsFor(p)} />
            {status !== 'EXPIRED' && (
              <ActionBtn icon={Pencil} label="Edit" onClick={() => (p.autoApply ? setSaleModal(p) : setCouponModal(p))} />
            )}
            {status === 'ACTIVE' && (
              <ActionBtn icon={Pause} label="Pause" onClick={() => handleToggleActive(p, false)} />
            )}
            {status === 'PAUSED' && (
              <ActionBtn icon={Play} label="Resume" onClick={() => handleToggleActive(p, true)} />
            )}
            {!p.autoApply && (
              <ActionBtn icon={Copy} label="Duplicate" onClick={() => handleDuplicate(p)} />
            )}
            {status !== 'EXPIRED' && (
              <ActionBtn icon={Trash2} label="Delete" onClick={() => handleDelete(p)} variant="danger" />
            )}
          </div>
        );
      },
    },
  ], [isPlatformContext]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <AdminPageHeader
        title="Sales and discounts"
        subtitle={`${total} sale${total !== 1 ? 's' : ''} & coupon${total !== 1 ? 's' : ''} total`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTargetedOffersOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Target className="w-4 h-4" />
              Targeted offers
            </button>
            <button
              type="button"
              onClick={() => setSaleModal('new')}
              className="flex items-center gap-1.5 px-4 py-2 bg-secondary hover:bg-secondary/90 text-white text-sm font-semibold rounded-button transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Set up a sale
            </button>
            <button
              type="button"
              onClick={() => setCouponModal('new')}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Promotion
            </button>
          </div>
        }
        queryKey={['admin-promotions']}
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <MiniStat label="Active Coupons" value={stats?.activeCoupons ?? '—'} icon={Tag} color="coral" />
        <MiniStat label="Used Today" value={stats?.usedToday ?? '—'} icon={Activity} color="blue" />
        <MiniStat label="Revenue Discounted" value={stats ? fmtAmount(stats.revenueDiscounted) : '—'} icon={TrendingDown} color="amber" />
        <MiniStat label="Avg Discount Value" value={stats ? fmtAmount(stats.avgDiscountValue) : '—'} icon={Zap} color="green" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
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

        <FilterSelect
          value={typeF}
          onChange={(v) => { setTypeF(v); setPage(1); }}
          options={[
            { value: '', label: 'All Types' },
            { value: 'PERCENTAGE',   label: '% Percentage'  },
            { value: 'FIXED_AMOUNT', label: '$ Fixed Amount' },
            { value: 'FREE_SHIPPING',label: 'Free Shipping'  },
          ]}
        />

        <FilterSelect
          value={statusF}
          onChange={(v) => { setStatusF(v); setPage(1); }}
          options={[
            { value: '',          label: 'All Statuses' },
            { value: 'ACTIVE',    label: 'Active'       },
            { value: 'PAUSED',    label: 'Paused'       },
            { value: 'EXPIRED',   label: 'Expired'      },
            { value: 'SCHEDULED', label: 'Scheduled'    },
          ]}
        />

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
        emptyTitle="No sales or promotions found"
        emptyDesc="Set up a sale or create a coupon code to get started."
      />

      {/* Bundle offers section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-secondary text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Buy them together
            </h2>
            <p className="text-xs text-muted mt-0.5">Bundle 2–3 listings at a discount when bought in the same order</p>
          </div>
          <button
            type="button"
            onClick={() => setBundleModal('new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors"
          >
            <Plus className="w-4 h-4" />
            New bundle
          </button>
        </div>

        {bundles.length === 0 ? (
          <div className="bg-surface rounded-card border border-dashed border-border p-8 text-center text-sm text-muted">
            <Package className="w-6 h-6 mx-auto mb-2 opacity-40" />
            No bundle offers yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((b) => (
              <div key={b.id} className="bg-surface rounded-card border border-border shadow-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-primary">{b.discountPercent}% off</span>
                  <StatusBadge status={b.isActive ? 'ACTIVE' : 'PAUSED'} />
                </div>
                <div className="flex -space-x-2 mb-3">
                  {b.products.map((p) => (
                    p.images[0]
                      ? <img key={p.id} src={p.images[0]} alt={p.name} className="w-9 h-9 rounded-full object-cover border-2 border-surface" />
                      : <div key={p.id} className="w-9 h-9 rounded-full bg-muted/10 border-2 border-surface flex items-center justify-center"><Package className="w-3.5 h-3.5 text-muted/40" /></div>
                  ))}
                </div>
                <p className="text-xs text-secondary truncate mb-3">{b.products.map((p) => p.name).join(' + ')}</p>
                <div className="flex items-center gap-1">
                  <ActionBtn icon={Pencil} label="Edit" onClick={() => setBundleModal(b)} />
                  {b.isActive
                    ? <ActionBtn icon={Pause} label="Pause" onClick={() => handleToggleBundle(b, false)} />
                    : <ActionBtn icon={Play} label="Resume" onClick={() => handleToggleBundle(b, true)} />}
                  <ActionBtn icon={Trash2} label="Delete" onClick={() => handleDeleteBundle(b)} variant="danger" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coupon modal */}
      {couponModal !== null && (
        <PromotionModal
          promotion={couponModal === 'new' ? null : couponModal}
          isPlatformContext={isPlatformContext}
          onClose={() => setCouponModal(null)}
          onSave={handleSaveCoupon}
        />
      )}

      {/* Sale modal */}
      {saleModal !== null && (
        <SetUpSaleModal
          sale={saleModal === 'new' ? null : saleModal}
          onClose={() => setSaleModal(null)}
          onSave={handleSaveSale}
        />
      )}

      {/* Bundle modal */}
      {bundleModal !== null && (
        <BuyTogetherModal
          bundle={bundleModal === 'new' ? null : bundleModal}
          onClose={() => setBundleModal(null)}
          onSave={handleSaveBundle}
        />
      )}

      {/* Let buyers make offers */}
      <BuyerOffersPanel />

      {/* Targeted offers modal */}
      {targetedOffersOpen && <TargetedOffersModal onClose={() => setTargetedOffersOpen(false)} />}

      {/* Stats drawer */}
      {statsFor && !statsFor.autoApply && (
        <PromotionStatsDrawer
          promotion={statsFor}
          onClose={() => setStatsFor(null)}
        />
      )}
    </>
  );
}
