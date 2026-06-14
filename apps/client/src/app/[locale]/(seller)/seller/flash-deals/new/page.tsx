'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@mlh/api-client';
import { useAuthStore } from '../../../../../../lib/store/auth.store';
import {
  Zap, Search, Package, Check, Loader2, AlertCircle, ChevronLeft,
  Clock, DollarSign, Info, BarChart2,
} from 'lucide-react';
import Link from 'next/link';

interface SellerProduct {
  id:          string;
  slug:        string;
  title:       string;
  price:       number;
  images:      string[];
  status:      string;
}

interface CreateFlashDealDto {
  productId:     string;
  discountPct:   number;
  startsAt:      string;
  endsAt:        string;
  quantityLimit: number | null;
}

interface CreatedDeal {
  id:     string;
  status: string;
}

const DURATION_OPTIONS = [
  { value: 6,  label: '6 hours'  },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
];

const CHECKLIST_ITEMS = [
  'My product is accurately described with current photos.',
  'I understand this deal requires admin approval before going live.',
  'I agree not to raise the original price within 7 days after the deal ends.',
  'I acknowledge that cancelled deals may affect my seller standing.',
];

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function fmtPrice(n: number) { return fmt.format(n); }

function localDateTimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addHours(base: Date, h: number): Date {
  return new Date(base.getTime() + h * 60 * 60 * 1000);
}

export default function NewFlashDealPage() {
  const token  = useAuthStore((s) => s.accessToken);
  const qc     = useQueryClient();

  const [search,        setSearch]        = useState('');
  const [selectedProduct, setSelectedProduct] = useState<SellerProduct | null>(null);
  const [discountPct,   setDiscountPct]   = useState(30);
  const [startAt,       setStartAt]       = useState<string>(() => localDateTimeValue(addHours(new Date(), 1)));
  const [durationHours, setDurationHours] = useState(12);
  const [quantityLimit, setQuantityLimit] = useState<string>('');
  const [checks,        setChecks]        = useState<boolean[]>(CHECKLIST_ITEMS.map(() => false));
  const [submitted,     setSubmitted]     = useState<CreatedDeal | null>(null);
  const [formError,     setFormError]     = useState<string | null>(null);

  const { data: products, isLoading: productsLoading } = useQuery<SellerProduct[]>({
    queryKey: ['seller', 'products', search],
    queryFn:  () => apiClient.get<SellerProduct[]>('/seller/products', {
      token:  token ?? undefined,
      params: search ? { q: search, status: 'ACTIVE' } : { status: 'ACTIVE' },
    }),
    enabled:  !!token,
    staleTime: 30_000,
  });

  const startDate = new Date(startAt);
  const endDate   = addHours(isNaN(startDate.getTime()) ? new Date() : startDate, durationHours);
  const dealPrice = selectedProduct
    ? selectedProduct.price * (1 - discountPct / 100)
    : 0;
  const savings = selectedProduct ? selectedProduct.price - dealPrice : 0;
  const qtyNum  = quantityLimit ? parseInt(quantityLimit, 10) : null;
  const estimatedRevenue = qtyNum && dealPrice ? qtyNum * dealPrice : null;

  const allChecked = checks.every(Boolean);
  const canSubmit  = !!selectedProduct && discountPct >= 20 && discountPct <= 60 && !isNaN(startDate.getTime()) && allChecked;

  const mutation = useMutation<CreatedDeal, Error, CreateFlashDealDto>({
    mutationFn: (dto) => apiClient.post<CreatedDeal>('/flash-deals', dto, { token: token ?? undefined }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['seller', 'flash-deals'] });
      setSubmitted(data);
    },
    onError: (err) => {
      setFormError(err.message ?? 'Failed to submit the flash deal. Please try again.');
    },
  });

  const handleSubmit = () => {
    if (!canSubmit || !selectedProduct) return;
    setFormError(null);
    mutation.mutate({
      productId:     selectedProduct.id,
      discountPct,
      startsAt:      startDate.toISOString(),
      endsAt:        endDate.toISOString(),
      quantityLimit: qtyNum && !isNaN(qtyNum) && qtyNum > 0 ? qtyNum : null,
    });
  };

  const toggleCheck = (i: number) => {
    setChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  };

  if (submitted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center text-center gap-6 py-16">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-secondary">Flash Deal Submitted!</h2>
            <p className="text-sm text-muted mt-2 max-w-sm mx-auto">
              Your deal is now awaiting admin review. You&apos;ll be notified once it&apos;s approved or if changes are needed.
            </p>
          </div>
          <div className="w-full max-w-md border border-border rounded-card overflow-hidden">
            {[
              { label: 'Submitted',        done: true,  active: false },
              { label: 'Admin Review',      done: false, active: true  },
              { label: 'Approved & Live',   done: false, active: false },
              { label: 'Deal Ends',         done: false, active: false },
            ].map((step, i) => (
              <div key={i} className={`flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 ${step.active ? 'bg-primary/5' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${step.done ? 'bg-primary text-white' : step.active ? 'border-2 border-primary text-primary' : 'border-2 border-border text-muted'}`}>
                  {step.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-sm font-medium ${step.done || step.active ? 'text-secondary' : 'text-muted'}`}>
                  {step.label}
                </span>
                {step.active && (
                  <span className="ml-auto text-xs text-primary font-semibold animate-pulse">In Progress</span>
                )}
              </div>
            ))}
          </div>
          <Link
            href="../flash-deals"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded-button transition-colors"
          >
            View My Flash Deals
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="../flash-deals"
          className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Flash Deals
        </Link>
        <span className="text-border">·</span>
        <h1 className="font-display text-xl font-bold text-secondary flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Create Flash Deal
        </h1>
      </div>

      <div className="space-y-8">
        <section className="border border-border rounded-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-secondary flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Select Product
          </h2>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your active listings…"
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {productsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading your products…
            </div>
          )}

          {!productsLoading && (products ?? []).length === 0 && (
            <div className="text-center py-8 text-sm text-muted">
              No active products found. Only active listings can run flash deals.
            </div>
          )}

          {!productsLoading && (products ?? []).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(products ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedProduct(p.id === selectedProduct?.id ? null : p)}
                  className={[
                    'text-left border rounded-card p-3 transition-all',
                    p.id === selectedProduct?.id
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                      : 'border-border hover:border-primary/40',
                  ].join(' ')}
                >
                  {p.images[0] ? (
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      className="w-full aspect-square object-cover rounded-input mb-2 border border-border"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-border/20 rounded-input mb-2 flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted/30" />
                    </div>
                  )}
                  <p className="text-xs font-semibold text-secondary line-clamp-2">{p.title}</p>
                  <p className="text-xs text-muted mt-0.5 tabular-nums">{fmtPrice(p.price)}</p>
                  {p.id === selectedProduct?.id && (
                    <div className="mt-2 flex items-center gap-1 text-primary">
                      <Check className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-semibold">Selected</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="border border-border rounded-card p-6 space-y-5">
          <h2 className="text-base font-semibold text-secondary flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Deal Settings
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wide">
                Discount Percentage
              </label>
              <div className="relative flex items-center gap-3">
                <input
                  type="range"
                  min={20}
                  max={60}
                  step={5}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="w-12 text-center text-sm font-bold text-primary tabular-nums">
                  {discountPct}%
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-muted">
                <span>20% min</span>
                <span>60% max</span>
              </div>
              <p className="text-xs text-muted flex items-center gap-1">
                <Info className="w-3 h-3 shrink-0" />
                Deals below 20% are not eligible for flash deal placement.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wide">
                Quantity Limit <span className="text-muted font-normal normal-case">(optional)</span>
              </label>
              <input
                type="number"
                min={1}
                value={quantityLimit}
                onChange={(e) => setQuantityLimit(e.target.value)}
                placeholder="No limit — first come, first served"
                className="w-full px-3 py-2.5 text-sm border border-border rounded-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wide">
                Start Date & Time
              </label>
              <input
                type="datetime-local"
                value={startAt}
                min={localDateTimeValue(new Date())}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-border rounded-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-secondary uppercase tracking-wide">
                Duration
              </label>
              <div className="flex gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDurationHours(opt.value)}
                    className={[
                      'flex-1 py-2.5 text-sm font-medium rounded-input border transition-colors',
                      durationHours === opt.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted hover:border-primary/40',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {selectedProduct && (
          <section className="border border-border rounded-card p-6 space-y-4">
            <h2 className="text-base font-semibold text-secondary flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Price Preview
            </h2>

            <div className="flex items-center gap-6 flex-wrap">
              <div className="space-y-1">
                <p className="text-xs text-muted uppercase tracking-wide font-semibold">Original Price</p>
                <p className="text-xl font-bold text-muted line-through tabular-nums">
                  {fmtPrice(selectedProduct.price)}
                </p>
              </div>
              <div className="text-2xl font-bold text-border">→</div>
              <div className="space-y-1">
                <p className="text-xs text-primary uppercase tracking-wide font-semibold">Flash Deal Price</p>
                <p className="text-xl font-bold text-secondary tabular-nums">
                  {fmtPrice(dealPrice)}
                </p>
              </div>
              <div className="ml-auto px-4 py-2 bg-primary/10 rounded-card text-center">
                <p className="text-xs text-muted">Buyer saves</p>
                <p className="text-lg font-bold text-primary tabular-nums">{fmtPrice(savings)}</p>
                <p className="text-xs text-primary font-semibold">{discountPct}% off</p>
              </div>
            </div>

            {estimatedRevenue !== null && (
              <div className="flex items-center gap-3 px-4 py-3 bg-background rounded-card border border-border">
                <BarChart2 className="w-4 h-4 text-primary shrink-0" />
                <p className="text-sm text-secondary">
                  If all <span className="font-bold">{qtyNum}</span> units sell, you&apos;ll earn approximately{' '}
                  <span className="font-bold text-primary">{fmtPrice(estimatedRevenue)}</span>{' '}
                  in revenue from this deal.
                </p>
              </div>
            )}
          </section>
        )}

        <section className="border border-border rounded-card p-6 space-y-4">
          <h2 className="text-base font-semibold text-secondary flex items-center gap-2">
            <Check className="w-4 h-4 text-primary" />
            Review & Confirm
          </h2>

          <div className="space-y-3">
            {CHECKLIST_ITEMS.map((item, i) => (
              <label
                key={i}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <div
                  className={[
                    'mt-0.5 w-4.5 h-4.5 min-w-[18px] rounded border flex items-center justify-center transition-colors',
                    checks[i]
                      ? 'bg-primary border-primary'
                      : 'border-border group-hover:border-primary/60',
                  ].join(' ')}
                  onClick={() => toggleCheck(i)}
                >
                  {checks[i] && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-secondary select-none">{item}</span>
              </label>
            ))}
          </div>
        </section>

        {formError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-error/5 border border-error/20 rounded-card text-error text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {formError}
          </div>
        )}

        <div className="flex items-center justify-end gap-4 pb-4">
          <Link
            href="../flash-deals"
            className="text-sm text-muted hover:text-secondary transition-colors"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || mutation.isPending}
            className={[
              'inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-button transition-colors',
              canSubmit && !mutation.isPending
                ? 'bg-primary hover:bg-primary/90 text-white'
                : 'bg-border text-muted cursor-not-allowed',
            ].join(' ')}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Submit for Review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
