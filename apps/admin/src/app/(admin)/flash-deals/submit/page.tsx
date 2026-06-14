'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Zap, Search, X, Package, Loader2, AlertCircle, CheckCircle2,
  Clock, ChevronDown, ChevronRight, ChevronLeft,
} from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount, fmtDateTime } from '../../../../lib/fmt';
import { type AdminProduct } from '../../../../components/products/ProductCard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MyFlashDeal {
  id:            string;
  productName:   string;
  productImage:  string | null;
  originalPrice: number;
  dealPrice:     number;
  discountPct:   number;
  startsAt:      string;
  endsAt:        string;
  quantityLimit: number | null;
  soldCount:     number;
  status:        string;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'Pending Review', cls: 'bg-amber-100 text-amber-700'  },
  APPROVED:  { label: 'Upcoming',       cls: 'bg-blue-100 text-blue-700'    },
  ACTIVE:    { label: 'Active',         cls: 'bg-primary/10 text-primary'   },
  ENDED:     { label: 'Ended',          cls: 'bg-muted/10 text-muted'       },
  CANCELLED: { label: 'Rejected',       cls: 'bg-error/10 text-error'       },
};

const PRODUCTS_PER_PAGE = 12;

const fieldCls = 'w-full border border-border rounded-input px-3 py-2.5 text-sm text-secondary bg-background placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

// ── Deal config panel ─────────────────────────────────────────────────────────

function DealConfigPanel({
  product,
  storeId,
  onClose,
  onSuccess,
}: {
  product:   AdminProduct;
  storeId:   string;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [dealPrice, setDealPrice] = useState('');
  const [qtyLimit,  setQtyLimit]  = useState('');
  const [startsAt,  setStartsAt]  = useState('');
  const [endsAt,    setEndsAt]    = useState('');

  const origPrice   = product.basePrice;
  const dealPriceN  = parseFloat(dealPrice);
  const discountPct = dealPrice && !isNaN(dealPriceN) && origPrice > 0
    ? Math.round(((origPrice - dealPriceN) / origPrice) * 100)
    : 0;
  const isValidDiscount  = discountPct >= 20 && discountPct < 100;
  const maxDealPrice     = (origPrice * 0.8).toFixed(2); // ensures ≥ 20% off

  const mutation = useMutation({
    mutationFn: () =>
      api.post<unknown>(API_ROUTES.ADMIN.FLASH_DEAL_CREATE, {
        storeId,
        productId:     product.id,
        originalPrice: origPrice,
        dealPrice:     dealPriceN,
        discountPct,
        startsAt:      new Date(startsAt).toISOString(),
        endsAt:        new Date(endsAt).toISOString(),
        ...(qtyLimit && { quantityLimit: parseInt(qtyLimit, 10) }),
      }),
    onSuccess,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidDiscount) return;
    mutation.mutate();
  }

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] bg-surface border-l border-border shadow-2xl z-40 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <h3 className="font-semibold text-secondary flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Configure Deal
        </h3>
        <button type="button" onClick={onClose} className="text-muted hover:text-secondary transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 flex-1 space-y-5">
        {/* Product preview */}
        <div className="rounded-card border border-border overflow-hidden">
          {product.primaryImageUrl ? (
            <div className="relative w-full h-40">
              <Image
                src={product.primaryImageUrl}
                alt={product.name}
                fill
                className="object-cover"
                sizes="400px"
              />
            </div>
          ) : (
            <div className="w-full h-40 bg-border/10 flex items-center justify-center">
              <Package className="w-10 h-10 text-muted/20" />
            </div>
          )}
          <div className="p-3">
            <p className="text-xs text-muted">{product.categoryName}</p>
            <p className="font-semibold text-secondary text-sm mt-0.5 line-clamp-2">{product.name}</p>
            <p className="text-base font-bold text-secondary mt-1 tabular-nums">{fmtAmount(origPrice)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Deal price */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wide">
              Deal Price ($)
              {dealPrice && (
                <span className={[
                  'px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors',
                  isValidDiscount
                    ? 'bg-primary/10 text-primary'
                    : 'bg-error/10 text-error',
                ].join(' ')}>
                  {discountPct > 0 ? `-${discountPct}%` : '—'}
                  {dealPrice && !isValidDiscount && discountPct < 20 && ' · min 20%'}
                </span>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium select-none">$</span>
              <input
                type="number"
                min="0.01"
                max={maxDealPrice}
                step="0.01"
                value={dealPrice}
                onChange={(e) => setDealPrice(e.target.value)}
                placeholder={`Max $${maxDealPrice} for 20%+ off`}
                required
                className={`${fieldCls} pl-7`}
              />
            </div>
            {isValidDiscount && (
              <div className="flex items-center justify-between text-xs bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
                <span className="text-muted">
                  {fmtAmount(origPrice)} → <span className="font-bold text-primary">{fmtAmount(dealPriceN)}</span>
                </span>
                <span className="font-bold text-green-600">Save {fmtAmount(origPrice - dealPriceN)}</span>
              </div>
            )}
          </div>

          {/* Qty limit */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary uppercase tracking-wide">
              Quantity Limit{' '}
              <span className="text-muted font-normal normal-case">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={qtyLimit}
              onChange={(e) => setQtyLimit(e.target.value)}
              placeholder="Leave blank for unlimited"
              className={fieldCls}
            />
          </div>

          {/* Date window */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide">Start Date & Time</label>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
                className={fieldCls}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-secondary uppercase tracking-wide">End Date & Time</label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                min={startsAt}
                required
                className={fieldCls}
              />
            </div>
          </div>

          {mutation.isError && (
            <div className="flex items-start gap-2 p-2.5 bg-error/8 border border-error/20 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 text-error shrink-0 mt-0.5" />
              <p className="text-xs text-error">Failed to submit. Check all fields and try again.</p>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || !isValidDiscount || !startsAt || !endsAt}
            className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-primary hover:bg-primary/90 text-white rounded-button transition-colors disabled:opacity-50"
          >
            {mutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" />
            }
            Submit for Review
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Product picker card ───────────────────────────────────────────────────────

function ProductPickerCard({
  product,
  isSelected,
  onSelect,
}: {
  product:    AdminProduct;
  isSelected: boolean;
  onSelect:   () => void;
}) {
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={[
        'group relative rounded-card border bg-surface cursor-pointer transition-all duration-150 overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/30',
        isSelected
          ? 'border-primary ring-2 ring-primary/30 shadow-md'
          : 'border-border hover:border-primary/50 hover:shadow-sm',
      ].join(' ')}
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-muted/10">
        {product.primaryImageUrl ? (
          <Image
            src={product.primaryImageUrl}
            alt={product.name}
            fill
            sizes="(max-width:640px) 50vw, (max-width:1280px) 33vw, 220px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-muted/20" />
          </div>
        )}

        {/* Selected overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-[10px] text-muted line-clamp-1 uppercase tracking-wide">{product.categoryName}</p>
        <p className="text-sm font-semibold text-secondary line-clamp-2 leading-snug mt-0.5">{product.name}</p>
        <p className="text-sm font-bold text-primary mt-1.5 tabular-nums">{fmtAmount(product.basePrice)}</p>
      </div>

      {/* Hover / selected CTA */}
      <div className={[
        'absolute bottom-0 left-0 right-0 py-1.5 text-center text-xs font-semibold bg-primary text-white transition-transform duration-150',
        isSelected ? 'translate-y-0' : 'translate-y-full group-hover:translate-y-0',
      ].join(' ')}>
        {isSelected ? '✓ Selected' : 'Select for Flash Deal'}
      </div>
    </div>
  );
}

// ── Existing deals (collapsible) ──────────────────────────────────────────────

function ExistingDealsList({ deals, loading }: { deals: MyFlashDeal[]; loading: boolean }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-8 bg-surface border border-border rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-border/5 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-secondary text-sm">
          My Submitted Deals
          {deals.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
              {deals.length}
            </span>
          )}
        </span>
        {open ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
      </button>

      {open && (
        <div className="border-t border-border">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : deals.length === 0 ? (
            <p className="text-sm text-muted py-5 px-5 text-center">No deals submitted yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {deals.map((deal) => {
                const cfg = STATUS_CFG[deal.status] ?? { label: deal.status, cls: 'bg-muted/10 text-muted' };
                return (
                  <div key={deal.id} className="flex items-center gap-4 px-5 py-3.5">
                    {deal.productImage ? (
                      <img
                        src={deal.productImage}
                        alt={deal.productName}
                        className="w-12 h-12 rounded-input object-cover border border-border shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-input bg-border/20 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-muted/40" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-secondary line-clamp-1">{deal.productName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold text-primary tabular-nums">{fmtAmount(deal.dealPrice)}</span>
                        <span className="text-xs text-muted line-through tabular-nums">{fmtAmount(deal.originalPrice)}</span>
                        <span className="text-xs font-bold text-primary">-{deal.discountPct}%</span>
                        {deal.soldCount > 0 && (
                          <span className="text-xs text-muted">· {deal.soldCount} sold</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-muted">
                        <Clock className="w-3 h-3 shrink-0" />
                        {fmtDateTime(deal.startsAt)} → {fmtDateTime(deal.endsAt)}
                      </div>
                    </div>

                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SellerFlashDealsPage() {
  const { data: session } = useSession();
  const user    = session?.user as Record<string, unknown> | undefined;
  const storeId = (user?.['storeId'] as string) ?? '';
  const qc      = useQueryClient();

  const [search,          setSearch]          = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page,            setPage]            = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null);
  const [successMsg,      setSuccessMsg]      = useState('');

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const productsQuery = useQuery<{ data: AdminProduct[]; pagination: { total: number } }>({
    queryKey: ['seller-product-picker', debouncedSearch, page],
    queryFn:  () => {
      const params = new URLSearchParams({
        limit:  String(PRODUCTS_PER_PAGE),
        page:   String(page),
        status: 'ACTIVE',
        ...(debouncedSearch && { search: debouncedSearch }),
      });
      return api.get(`${API_ROUTES.ADMIN.PRODUCTS}?${params}`);
    },
    staleTime: 60_000,
  });

  const products   = productsQuery.data?.data ?? [];
  const totalPages = Math.ceil((productsQuery.data?.pagination?.total ?? 0) / PRODUCTS_PER_PAGE);

  const dealsQuery = useQuery<{ data: MyFlashDeal[]; total: number }>({
    queryKey: ['seller-flash-deals'],
    queryFn:  () =>
      api.get<{ data: MyFlashDeal[]; total: number }>('/admin/flash-deals', {
        params: { limit: '50' },
      }),
  });
  const myDeals = dealsQuery.data?.data ?? [];

  const handleSuccess = useCallback(() => {
    setSelectedProduct(null);
    qc.invalidateQueries({ queryKey: ['seller-flash-deals'] });
    setSuccessMsg("Deal submitted for admin review. You'll be notified once it's approved.");
    setTimeout(() => setSuccessMsg(''), 6000);
  }, [qc]);

  function toggleProduct(product: AdminProduct) {
    setSelectedProduct((prev) => (prev?.id === product.id ? null : product));
  }

  return (
    <>
      <AdminPageHeader
        title="Flash Deals"
        subtitle="Pick a product and configure your limited-time offer"
        queryKey={['seller-flash-deals', 'seller-product-picker']}
      />

      {/* Success banner */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-card text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="flex-1">{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-green-500 hover:text-green-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-card">
        <Zap className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-primary text-sm">How Flash Deals work</p>
          <p className="text-muted text-xs mt-0.5">
            Select an active product, set a deal price with at least 20% off, then choose your deal window.
            Our team reviews within 24 h — approved deals go live at the scheduled time.
          </p>
        </div>
      </div>

      {/* My submitted deals */}
      <ExistingDealsList deals={myDeals} loading={dealsQuery.isLoading} />

      {/* Product picker */}
      <div className={selectedProduct ? 'pr-[420px] transition-all duration-200' : 'transition-all duration-200'}>
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <h2 className="font-semibold text-secondary shrink-0">Select a Product</h2>

          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your products…"
              className="w-full border border-border rounded-input pl-9 pr-9 py-2 text-sm bg-background placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {debouncedSearch && (
            <p className="text-sm text-muted shrink-0">
              {productsQuery.data?.pagination?.total ?? 0} results for &ldquo;{debouncedSearch}&rdquo;
            </p>
          )}
        </div>

        {productsQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Package className="w-12 h-12 text-muted/20" />
            <p className="font-semibold text-secondary">No active products found</p>
            <p className="text-sm text-muted">
              {debouncedSearch
                ? `No results for &ldquo;${debouncedSearch}&rdquo;`
                : 'Your store has no active products yet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
              {products.map((product) => (
                <ProductPickerCard
                  key={product.id}
                  product={product}
                  isSelected={selectedProduct?.id === product.id}
                  onSelect={() => toggleProduct(product)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-button disabled:opacity-40 hover:border-primary/60 hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-sm text-muted tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border border-border rounded-button disabled:opacity-40 hover:border-primary/60 hover:text-primary transition-colors"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Config panel */}
      {selectedProduct && (
        <DealConfigPanel
          product={selectedProduct}
          storeId={storeId}
          onClose={() => setSelectedProduct(null)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
