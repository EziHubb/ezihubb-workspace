'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Search, X, Sparkles, Eye, ShoppingCart, PackageCheck, Heart, Tag,
  HandCoins, BadgePercent, ShoppingBag, Boxes, PartyPopper,
  Copy, Pause, Play, Trash2, BarChart2, Pencil, Package,
} from 'lucide-react';
import { Modal, ModalHeroHeader, Button } from '@ezihubb/ui';
import { DataTable } from '../../../../components/data/DataTable';
import { PromotionModal, type Promotion, type PromotionFormData } from '../../../../components/promotions/PromotionModal';
import { PromotionStatsDrawer } from '../../../../components/promotions/PromotionStatsDrawer';
import { SetUpSaleModal, type SaleFormData } from '../../../../components/marketing/SetUpSaleModal';
import { OrderMinimumModal, type OrderMinimumFormData, type OrderMinimumPromotion } from '../../../../components/marketing/OrderMinimumModal';
import { BuyTogetherModal, type BundleFormData, type BundleOffer } from '../../../../components/marketing/BuyTogetherModal';
import { TargetedOffersModal } from '../../../../components/marketing/TargetedOffersModal';
import { BuyerOffersPanel } from '../../../../components/marketing/BuyerOffersPanel';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { startOfLocalDayISO, endOfLocalDayISO } from '../../../../lib/promo-dates';
import { fmtAmount, fmtDate, fmtNum } from '../../../../lib/fmt';
import { useDialog } from '../../../../contexts/DialogContext';
import { FilterSelect } from '../../../../components/ui/FilterSelect';
import { ReloadButton } from '../../../../components/ui/ReloadButton';
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

// ── Entry-point card (Etsy's "Set up →" hub cards) ─────────────────────────────

function EntryCard({
  icon: Icon, title, desc, onClick,
}: {
  icon?:   React.ElementType;
  title:   string;
  desc:    string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-surface border border-border rounded-card p-4 hover:border-primary/40 transition-colors"
    >
      {Icon && (
        <div className="w-7 h-7 mb-2.5 text-secondary">
          <Icon className="w-full h-full" strokeWidth={1.6} />
        </div>
      )}
      <h4 className="text-sm font-bold text-secondary mb-1">{title}</h4>
      <p className="text-xs text-muted leading-relaxed mb-2.5">{desc}</p>
      <span className="text-xs font-bold text-secondary">Set up →</span>
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
  const { isPlatformContext, isReady } = useAdminMode();

  const [tab, setTab] = useState<'promotions' | 'stats'>('promotions');

  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [typeF,    setTypeF]    = useState('');
  const [statusF,  setStatusF]  = useState('');
  const [couponModal, setCouponModal] = useState<Promotion | null | 'new'>(null);
  const [saleModal,   setSaleModal]   = useState<Promotion | null | 'new'>(null);
  const [statsFor, setStatsFor] = useState<Promotion | null>(null);

  const [bundleModal, setBundleModal] = useState<BundleOffer | null | 'new'>(null);
  const [targetedOffersOpen, setTargetedOffersOpen] = useState(false);
  const [orderMinModal, setOrderMinModal] = useState<OrderMinimumPromotion | null | 'new'>(null);
  const [buyerOffersOpen, setBuyerOffersOpen] = useState(false);

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

  // "Your key sales and discounts" — top active auto-apply sales, no filters, last 30 days worth
  const keySalesQuery = useQuery({
    queryKey: ['admin-promotions-key-sales'],
    queryFn:  () => api.get<{ data: Promotion[] }>(API_ROUTES.ADMIN.PROMOTIONS, { params: { page: '1', limit: '5', autoApply: 'true' } }),
  });
  const keySales = (keySalesQuery.data?.data ?? []).filter((p) => p.autoApply);

  // ── Bundle offers query ──────────────────────────────────────────────────────
  // Bundles (and the other seller self-service tools below — targeted offers,
  // buyer offers, order minimum) are scoped to one store server-side with no
  // platform-wide aggregate; skip the fetch entirely in platform context
  // rather than let it 400 on mount.
  const bundlesQuery = useQuery({
    queryKey: ['admin-bundle-offers'],
    queryFn:  () => api.get<BundleOffer[]>(API_ROUTES.ADMIN.BUNDLE_OFFERS),
    // Must wait for isReady too — while the session is still resolving,
    // isPlatformContext defaults to false (not "known false"), so gating on
    // just !isPlatformContext would fire this before we actually know.
    enabled:  isReady && !isPlatformContext,
  });
  const bundles = bundlesQuery.data ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-promotions'] });
    qc.invalidateQueries({ queryKey: ['admin-promotions-key-sales'] });
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
      type:                data.discountType,
      value:               data.discountType === 'FREE_SHIPPING' ? 0 : data.value,
      autoApply:           true,
      scope:               data.scope,
      productIds:          data.scope === 'SPECIFIC_LISTINGS' ? data.productIds : undefined,
      country:             data.country || undefined,
      // The seller picked days; only this side knows which timezone those
      // days belong to. See lib/promo-dates.
      startsAt:            startOfLocalDayISO(data.startsAt),
      expiresAt:           endOfLocalDayISO(data.expiresAt),
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

  const handleSaveOrderMinimum = async (data: OrderMinimumFormData, id?: string) => {
    const payload = {
      description:    data.description,
      type:            'PERCENTAGE',
      value:           data.value,
      autoApply:       true,
      scope:           'SHOP_WIDE',
      minOrderAmount:  data.minOrderAmount,
      country:         data.country || undefined,
      startsAt:        startOfLocalDayISO(data.startsAt),
      expiresAt:       endOfLocalDayISO(data.expiresAt),
    };
    if (id) {
      await api.patch(API_ROUTES.ADMIN.PROMOTION(id), payload);
    } else {
      await api.post(API_ROUTES.ADMIN.PROMOTIONS, payload);
    }
    invalidate();
    setOrderMinModal(null);
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

  // ── Columns (Details & Stats tab) ────────────────────────────────────────────

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
      header: 'Runs',
      size:   150,
      /**
       * Both ends of the window, not just the expiry.
       *
       * A sale can sit here reading "Scheduled" with no way to see WHEN it
       * starts, which is the one thing that explains why prices have not
       * moved. Showing the expiry alone answered the question nobody was
       * asking.
       */
      cell: ({ row }: { row: { original: Promotion } }) => {
        const p = row.original;
        return (
          <div className="text-xs text-muted leading-tight">
            {p.startsAt && (
              <div>{getStatus(p) === 'SCHEDULED' ? 'Starts ' : 'From '}{fmtDate(p.startsAt)}</div>
            )}
            <div>{p.expiresAt ? `Until ${fmtDate(p.expiresAt)}` : <span className="italic">Never expires</span>}</div>
          </div>
        );
      },
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
              <ActionBtn
                icon={Pencil}
                label="Edit"
                onClick={() => {
                  if (p.minOrderAmount != null) setOrderMinModal(p);
                  else if (p.autoApply) setSaleModal(p);
                  else setCouponModal(p);
                }}
              />
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
            {/* Delete is offered for every status, EXPIRED included. It used to be
                hidden once a sale expired, which is exactly when a seller wants
                it gone — an expired sale had no way off the list at all. */}
            <ActionBtn icon={Trash2} label="Delete" onClick={() => handleDelete(p)} variant="danger" />
          </div>
        );
      },
    },
  ], [isPlatformContext]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-secondary">Sales and discounts</h1>
        <ReloadButton queryKey={['admin-promotions']} />
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border mb-6">
        <button
          type="button"
          onClick={() => setTab('promotions')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'promotions' ? 'border-secondary text-secondary' : 'border-transparent text-muted hover:text-secondary'}`}
        >
          Promotions
        </button>
        <button
          type="button"
          onClick={() => setTab('stats')}
          className={`pb-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === 'stats' ? 'border-secondary text-secondary' : 'border-transparent text-muted hover:text-secondary'}`}
        >
          Details &amp; Stats
        </button>
      </div>

      {tab === 'promotions' ? (
        <div className="space-y-10">
          {/* Your key sales and discounts */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg font-bold text-secondary">Your key sales and discounts</h2>
              <span className="text-xs text-muted">Last 30 Days</span>
            </div>
            <div className="bg-surface rounded-card border border-border p-2">
              {keySales.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">No sales or promotions found. Set up a sale or create a coupon code below to get started.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-muted border-b border-border">
                      <th className="py-2 px-3 font-semibold">Type</th>
                      <th className="py-2 px-3 font-semibold">Discount</th>
                      <th className="py-2 px-3 font-semibold text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keySales.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 px-3">
                          <button type="button" onClick={() => (p.minOrderAmount != null ? setOrderMinModal(p) : setSaleModal(p))} className="font-semibold text-secondary hover:underline">
                            {p.scope === 'SPECIFIC_LISTINGS' ? 'Listing sale' : 'Shop-wide sale'} ›
                          </button>
                          <div className="text-xs text-muted mt-0.5">
                            {p.startsAt ? fmtDate(p.startsAt) : '—'} – {p.expiresAt ? fmtDate(p.expiresAt) : 'No end date'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">{p.value}%</td>
                        {/* Etsy's real column set here is Offers granted/Purchases/Conversion
                            rate/Revenue — a full view→offer→purchase funnel we don't track
                            per-promotion yet. Revenue shows 0 rather than a fabricated number. */}
                        <td className="py-2.5 px-3 text-right tabular-nums">{fmtAmount(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Seller self-service tools (targeted offers, buyer offers, order
              minimum, bundles) are scoped to one store — not meaningful (and
              not functional, server-side) without an active store context. */}
          {isPlatformContext ? (
            <section className="text-center py-10 border border-dashed border-border rounded-card">
              <p className="text-sm font-semibold text-secondary mb-1">Store-specific tools hidden in platform view</p>
              <p className="text-sm text-muted max-w-md mx-auto">
                Targeted offers, buyer offers, order minimums, and bundles are managed per store — switch into a store to set them up.
              </p>
            </section>
          ) : (
            <>
              {/* Send offers to interested buyers */}
              <section>
                <div className="mb-3">
                  <h2 className="font-display text-lg font-bold text-secondary">Send offers to interested buyers</h2>
                  <p className="text-sm text-muted mt-0.5">Create an offer to motivate interested shoppers automatically, or create a promo code to share with anyone you like.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <EntryCard icon={Eye}          title="Interested shopper offer" desc="Send an offer when someone shows early interest in your items." onClick={() => setTargetedOffersOpen(true)} />
                  <EntryCard icon={ShoppingCart} title="Abandoned basket offer"   desc="Send an offer when someone leaves an item from your shop in their basket." onClick={() => setTargetedOffersOpen(true)} />
                  <EntryCard icon={PackageCheck} title="Thank you offer"          desc="Send an offer to a buyer after their order dispatches, to thank them." onClick={() => setTargetedOffersOpen(true)} />
                  <EntryCard icon={Heart}        title="Favourited item offer"    desc="Send an offer when someone favourites one of your items." onClick={() => setTargetedOffersOpen(true)} />
                  <EntryCard icon={Tag}          title="Promo code"               desc="Share your code with customers — they apply it for a discount at checkout." onClick={() => setCouponModal('new')} />
                </div>
              </section>

              {/* Drive traffic and move inventory */}
              <section>
                <div className="mb-3">
                  <h2 className="font-display text-lg font-bold text-secondary">Drive traffic and move inventory</h2>
                  <p className="text-sm text-muted mt-0.5">Start your own sale to boost traffic, or accept offers from buyers on select listings to move inventory.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <EntryCard icon={HandCoins}    title="Accept offers from buyers" desc="Choose specific listings, set a discount limit, and have the final say." onClick={() => setBuyerOffersOpen(true)} />
                  <EntryCard icon={BadgePercent} title="Run a sale"                desc="Set lower prices for your whole shop or just a few items — no code needed." onClick={() => setSaleModal('new')} />
                </div>
              </section>

              {/* Up your average order value */}
              <section>
                <div className="mb-3">
                  <h2 className="font-display text-lg font-bold text-secondary">Up your average order value</h2>
                  <p className="text-sm text-muted mt-0.5">Encourage buyers to place bigger orders and get the most out of every sale.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <EntryCard icon={ShoppingBag} title="Set an order minimum" desc="Set up a discount with an order minimum to help boost order value." onClick={() => setOrderMinModal('new')} />
                  <EntryCard icon={Boxes}       title="Bundle items together" desc="Sweeten the deal with a discount on items buyers might want together." onClick={() => setBundleModal('new')} />
                </div>

                {bundles.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {bundles.map((b) => (
                      <div key={b.id} className="bg-surface rounded-card border border-border p-4">
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
              </section>
            </>
          )}

          {/* Join our next sales events — platform-wide, no real events calendar */}
          <section className="text-center py-10">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-background flex items-center justify-center text-muted">
              <PartyPopper className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold text-secondary mb-1">Join our next sales events</h3>
            <p className="text-sm text-muted">There aren&apos;t any sales events — check again soon.</p>
          </section>
        </div>
      ) : (
        <div>
          {/* Stats mini row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface rounded-card border border-border p-4">
              <p className="text-xs text-muted mb-1">Active Coupons</p>
              <p className="font-display text-xl font-bold text-secondary tabular-nums">{stats?.activeCoupons ?? '—'}</p>
            </div>
            <div className="bg-surface rounded-card border border-border p-4">
              <p className="text-xs text-muted mb-1">Used Today</p>
              <p className="font-display text-xl font-bold text-secondary tabular-nums">{stats?.usedToday ?? '—'}</p>
            </div>
            <div className="bg-surface rounded-card border border-border p-4">
              <p className="text-xs text-muted mb-1">Revenue Discounted</p>
              <p className="font-display text-xl font-bold text-secondary tabular-nums">{stats ? fmtAmount(stats.revenueDiscounted) : '—'}</p>
            </div>
            <div className="bg-surface rounded-card border border-border p-4">
              <p className="text-xs text-muted mb-1">Avg Discount Value</p>
              <p className="font-display text-xl font-bold text-secondary tabular-nums">{stats ? fmtAmount(stats.avgDiscountValue) : '—'}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-[220px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search coupon code…"
                className="w-full pl-9 pr-8 py-2 text-sm border border-border rounded-pill bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
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

          <DataTable
            data={promotions}
            columns={columns}
            isLoading={listQuery.isLoading}
            pagination={{ page, limit: PAGE_SIZE, total, onPageChange: setPage }}
            emptyTitle="No sales or promotions found"
            emptyDesc="Set up a sale or create a coupon code to get started."
          />
        </div>
      )}

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

      {/* Order minimum modal */}
      {orderMinModal !== null && (
        <OrderMinimumModal
          promotion={orderMinModal === 'new' ? null : orderMinModal}
          onClose={() => setOrderMinModal(null)}
          onSave={handleSaveOrderMinimum}
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
      {buyerOffersOpen && (
        <Modal isOpen onClose={() => setBuyerOffersOpen(false)} size="md">
          <ModalHeroHeader
            icon={<HandCoins className="w-7 h-7" />}
            title="Let buyers make offers"
            subtitle="Buyers can propose a lower price on eligible listings for you to accept, reject, or counter."
            band="periwinkle"
            onClose={() => setBuyerOffersOpen(false)}
          />
          <div className="overflow-y-auto px-6 py-5">
            <BuyerOffersPanel embedded />
          </div>
          <div className="shrink-0 border-t border-border px-6 py-4">
            <Button variant="ghost" onClick={() => setBuyerOffersOpen(false)}>Done</Button>
          </div>
        </Modal>
      )}

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
