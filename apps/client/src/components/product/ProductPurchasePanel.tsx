'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  Star, CheckCircle2, Clock, ShoppingCart,
  Loader2, Plus, ChevronDown, Users, Link2, Dices,
} from 'lucide-react';
import { ShareButton } from './ShareButton';
import {
  ItemDetailsAccordion,
  ShippingReturnsAccordion,
  PurchaseProtectionAccordion,
  FAQsAccordion,
  MeetYourSellersAccordion,
} from './ProductAccordions';
import { useCartStore } from '../../lib/store/cart.store';
import { MobileStickyCartBar } from './MobileStickyCartBar';
import { toast } from '../../lib/store/toast.store';
import { useCurrency } from '../../lib/currency/currency-context';
import { analytics } from '../../lib/analytics';
import { CreateGiftPoolPanel } from '../gift-pools/CreateGiftPoolPanel';
import type { ProductDto, ReviewSummaryDto } from '@mlh/types';

// ── Date helpers (no date-fns) ────────────────────────────────────────────────

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) added++;
  }
  return d;
}

function addCalendarDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Field type from ProductDto['customization'] ───────────────────────────────

type CustomField = NonNullable<ProductDto['customization']>['fields'][number];

// ── InDemandBadge ─────────────────────────────────────────────────────────────

function InDemandBadge({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-secondary">
      <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
      <span>
        <strong>{count} people</strong> bought this in the last 24 hours
      </span>
    </div>
  );
}

// ── PriceBlock ────────────────────────────────────────────────────────────────

function PriceBlock({
  price,
  compareAtPrice,
  discountPercent,
}: {
  price:          number;
  compareAtPrice?: number;
  discountPercent: number | null;
}) {
  const { format } = useCurrency();
  return (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-secondary">
          {format(price)}
        </span>
        {compareAtPrice && compareAtPrice > price && (
          <span className="text-base text-muted line-through">
            {format(compareAtPrice)}
          </span>
        )}
        {discountPercent !== null && discountPercent > 0 && (
          <span className="text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            {discountPercent}% off
          </span>
        )}
      </div>
      {discountPercent !== null && discountPercent > 0 && (
        <p className="text-xs text-muted mt-0.5">Limited time sale</p>
      )}
      <p className="text-xs text-muted mt-1">Local taxes included (where applicable)</p>
    </div>
  );
}

// ── DeliveryInfo ──────────────────────────────────────────────────────────────

function DeliveryInfo({ processingDays }: { processingDays: number }) {
  const today       = new Date();
  const shipBy      = addBusinessDays(today, processingDays);
  const deliveryMin = addCalendarDays(shipBy, 5);
  const deliveryMax = addCalendarDays(shipBy, 10);

  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center gap-2 text-secondary">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span>Free shipping</span>
      </div>
      <div className="flex items-center gap-2 text-secondary">
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span>
          Arrives soon! Get it by{' '}
          <strong>{fmtDate(deliveryMin)}–{fmtDate(deliveryMax)}</strong> if you order today
        </span>
      </div>
      <div className="flex items-center gap-2 text-secondary">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span>Returns &amp; exchanges accepted</span>
      </div>
    </div>
  );
}

// ── RatingRow ─────────────────────────────────────────────────────────────────

function RatingRow({
  averageRating,
  totalReviews,
}: {
  averageRating: number;
  totalReviews:  number;
}) {
  const rounded = Math.round(averageRating);
  return (
    <a href="#reviews" className="flex items-center gap-1.5 text-sm hover:underline w-fit">
      <span className="font-semibold">{averageRating.toFixed(1)}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3.5 h-3.5 ${
              s <= rounded
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
      <span className="text-muted">({totalReviews.toLocaleString()} reviews)</span>
    </a>
  );
}

// ── VariantDropdown ───────────────────────────────────────────────────────────

function VariantDropdown({
  label,
  values,
  selected,
  onChange,
  hasError,
  id,
}: {
  label:    string;
  values:   string[];
  selected: string;
  onChange: (v: string) => void;
  hasError?: boolean;
  id?:       string;
}) {
  return (
    <div id={id}>
      <label className="text-sm font-medium block mb-1.5">
        {label} <span className="text-red-500">*</span>
      </label>
      {hasError && !selected && (
        <p className="text-xs text-red-500 mb-1">Please select an option</p>
      )}
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className={[
            'w-full appearance-none border rounded-lg px-3 py-2.5 text-sm bg-white pr-8',
            'cursor-pointer transition-colors focus:outline-none focus:ring-2',
            selected
              ? 'border-primary text-secondary focus:ring-primary/20'
              : hasError
                ? 'border-red-400 text-muted focus:ring-red-200 bg-red-50'
                : 'border-border text-muted focus:ring-primary/20',
          ].join(' ')}
        >
          <option value="">Select an option</option>
          {values.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </div>
    </div>
  );
}

// ── QuantityDropdown ──────────────────────────────────────────────────────────

function QuantityDropdown({
  value,
  onChange,
  label,
}: {
  value:    number;
  onChange: (n: number) => void;
  label:    string;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full appearance-none border border-border rounded-lg px-3 py-2.5 text-sm bg-white pr-8 cursor-pointer text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      </div>
    </div>
  );
}

// ── PersonalizationCollapsible ────────────────────────────────────────────────

function PersonalizationCollapsible({
  fields,
  isOpen,
  onToggle,
  label,
}: {
  fields:   CustomField[];
  isOpen:   boolean;
  onToggle: () => void;
  label:    string;
}) {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const set = (id: string, val: string) =>
    setResponses((prev) => ({ ...prev, [id]: val }));

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
      >
        <Plus className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-45' : ''}`} />
        {label}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-4 pl-4 border-l-2 border-border">
          {fields.map((field) => {
            const val = responses[field.id] ?? '';
            return (
              <div key={field.id}>
                <label className="text-xs font-medium text-secondary block mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    value={val}
                    onChange={(e) => set(field.id, e.target.value)}
                    rows={3}
                    maxLength={field.maxLength}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                ) : field.type === 'text' ? (
                  <input
                    value={val}
                    onChange={(e) => set(field.id, e.target.value)}
                    maxLength={field.maxLength}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={val}
                    onChange={(e) => set(field.id, e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select...</option>
                    {field.options?.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : field.type === 'color' ? (
                  <input
                    type="color"
                    value={val || '#000000'}
                    onChange={(e) => set(field.id, e.target.value)}
                    className="h-10 w-20 border border-border rounded-lg cursor-pointer"
                  />
                ) : (
                  // image upload
                  <input type="file" accept="image/*" className="text-sm" />
                )}

                {field.maxLength && (field.type === 'text' || field.type === 'textarea') && (
                  <p className="text-xs text-muted text-right mt-0.5">
                    {val.length}/{field.maxLength}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── StarSellerBadge ───────────────────────────────────────────────────────────

function StarSellerBadge({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-3 p-3 border border-border rounded-xl bg-[#FAFAF8]">
      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
        <Star className="w-5 h-5 text-primary fill-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// ── ProductPurchasePanel ──────────────────────────────────────────────────────

interface Props {
  product:       ProductDto;
  reviewSummary: ReviewSummaryDto | null;
  locale?:       string;
}

export function ProductPurchasePanel({ product, reviewSummary }: Props) {
  const t      = useTranslations('product');
  const locale = useLocale();
  const [selectedOptions,       setSelectedOptions]       = useState<Record<string, string>>({});
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [isAdding,              setIsAdding]              = useState(false);
  const [quantity,              setQuantity]              = useState(1);
  const [hasAttemptedSubmit,    setHasAttemptedSubmit]    = useState(false);
  const [giftPoolOpen,          setGiftPoolOpen]          = useState(false);
  const [giftPoolShareUrl,      setGiftPoolShareUrl]      = useState<string | null>(null);

  const addItem    = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

  // Fire viewItem once on mount
  useEffect(() => {
    analytics.viewItem({
      id:       product.id,
      name:     product.name,
      category: product.primaryCategory?.name ?? '',
      price:    Number(product.basePrice),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  // ── Variant resolution ────────────────────────────────────────────────────

  const selectedVariant = useMemo(() => {
    if (!product.variants?.length) return null;
    const lc = (s: unknown) => String(s).toLowerCase();
    // Exact match first; case-insensitive fallback handles admin-entered options
    // whose keys/values don't perfectly match VariationGroup casing.
    return (
      product.variants.find((v) =>
        Object.entries(selectedOptions).every(([k, val]) => v.options[k] === val),
      ) ??
      product.variants.find((v) =>
        Object.entries(selectedOptions).every(([k, val]) =>
          Object.entries(v.options ?? {}).some(
            ([vk, vv]) => lc(vk) === lc(k) && lc(vv) === lc(val),
          ),
        ),
      ) ??
      null
    );
  }, [selectedOptions, product.variants]);

  const currentPrice   = selectedVariant?.price ?? product.basePrice;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const discountPercent =
    compareAtPrice && compareAtPrice > currentPrice
      ? Math.round((1 - currentPrice / compareAtPrice) * 100)
      : null;

  const variantCount  = product.variantOptions?.length ?? 0;
  const allOptionsSelected = Object.keys(selectedOptions).length === variantCount;
  const canAddToCart  =
    variantCount === 0 ||
    (allOptionsSelected && selectedVariant !== null);

  const customFields = product.customization?.fields ?? [];

  // ── Add to cart ───────────────────────────────────────────────────────────

  const handleAddToCart = async () => {
    if (!canAddToCart) {
      setHasAttemptedSubmit(true);
      if (allOptionsSelected && selectedVariant === null) {
        // All options chosen but no DB variant matches — data mismatch
        toast.error('This combination is not available. Please try different options.');
      } else {
        // Some options still need to be selected
        const firstMissing = product.variantOptions?.find(
          (opt) => !selectedOptions[opt.name],
        );
        if (firstMissing) {
          document.getElementById(`variant-${firstMissing.name}`)?.scrollIntoView({
            behavior: 'smooth', block: 'center',
          });
        }
        toast.error('Please select all required options before adding to cart.');
      }
      return;
    }
    if (isAdding) return;
    setIsAdding(true);
    try {
      await addItem({
        productId:         product.id,
        variantId:         selectedVariant?.id ?? null,
        quantity,
        customizationData: null,
      });
      openDrawer();
      toast.success('Added to cart!');
    } catch {
      toast.error('Could not add to cart. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="lg:sticky lg:top-4 space-y-4">

      {/* ── IN-DEMAND BADGE ── */}
      {(product.soldCount24h ?? 0) >= 2 && (
        <InDemandBadge count={product.soldCount24h!} />
      )}

      {/* ── FEATURED BADGE ── */}
      {product.isFeatured && (
        <div className="inline-flex items-center gap-1.5 bg-[#FFF0EC] text-primary text-xs font-medium px-2.5 py-1 rounded-full">
          <Star className="w-3 h-3 fill-primary" />
          Daily Daisy&apos;s Pick
        </div>
      )}

      {/* ── TITLE ── */}
      <h1 className="text-2xl font-semibold text-secondary leading-snug">
        {product.name}
      </h1>

      {/* ── PRICE ── */}
      <PriceBlock
        price={currentPrice}
        compareAtPrice={compareAtPrice}
        discountPercent={discountPercent}
      />

      {/* ── DELIVERY INFO ── */}
      <DeliveryInfo processingDays={product.processingDays ?? 3} />

      {/* ── RATING + SHARE ROW ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {reviewSummary && reviewSummary.totalReviews > 0 && (
            <RatingRow
              averageRating={reviewSummary.averageRating}
              totalReviews={reviewSummary.totalReviews}
            />
          )}
        </div>
        <ShareButton productSlug={product.slug} productName={product.name} />
      </div>

      {/* ── VARIANT DROPDOWNS ── */}
      {variantCount > 0 && (
        <div className="space-y-3">
          {product.variantOptions!.map((opt) => (
            <VariantDropdown
              key={opt.name}
              id={`variant-${opt.name}`}
              label={opt.name}
              values={opt.values}
              selected={selectedOptions[opt.name] ?? ''}
              onChange={(v) => {
                setSelectedOptions((prev) => ({ ...prev, [opt.name]: v }));
              }}
              hasError={hasAttemptedSubmit && !selectedOptions[opt.name]}
            />
          ))}
        </div>
      )}

      {/* ── ADD PERSONALIZATION ── */}
      {product.isPersonalizable && customFields.length > 0 && (
        <PersonalizationCollapsible
          fields={customFields}
          isOpen={isPersonalizationOpen}
          onToggle={() => setIsPersonalizationOpen((o) => !o)}
          label={t('actions.addPersonalization')}
        />
      )}

      {/* ── QUANTITY ── */}
      <QuantityDropdown value={quantity} onChange={setQuantity} label={t('actions.quantity')} />

      {/* ── ADD TO CART ── */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={isAdding}
        className={[
          'w-full py-3.5 rounded-full font-semibold text-sm transition-all',
          'flex items-center justify-center gap-2',
          'bg-primary text-white hover:bg-primary-dark active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        {isAdding ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('actions.adding')}
          </>
        ) : (
          <>
            <ShoppingCart className="w-4 h-4" />
            {t('actions.addToCart')}
          </>
        )}
      </button>

      {/* ── GROUP GIFT / GIFT POOL ── */}
      <div className="border border-border rounded-xl overflow-hidden">
        {giftPoolShareUrl ? (
          <div className="p-4 bg-green-50 border-green-200 space-y-2">
            <p className="text-sm font-semibold text-green-800">Gift pool created!</p>
            <p className="text-xs text-green-600">Share this link with contributors:</p>
            <div className="flex gap-2">
              <code className="flex-1 bg-white border border-green-200 rounded-lg px-3 py-1.5 text-xs font-mono text-green-800 truncate">
                {giftPoolShareUrl}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(giftPoolShareUrl)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        ) : giftPoolOpen ? (
          <CreateGiftPoolPanel
            product={{ id: product.id, name: product.name, basePrice: Number(product.basePrice), imageUrl: product.images?.[0]?.url ?? null }}
            onClose={() => setGiftPoolOpen(false)}
            onCreated={(url) => { setGiftPoolShareUrl(url); setGiftPoolOpen(false); }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setGiftPoolOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-secondary">Gift this together</p>
              <p className="text-xs text-muted">Pool money with friends or family</p>
            </div>
            <ChevronDown className="w-4 h-4 text-muted rotate-[-90deg]" />
          </button>
        )}
      </div>

      {/* ── GIFT CHAIN ENTRY ── */}
      <Link
        href={`/${locale}/chain/start?productId=${product.id}`}
        className="flex items-center gap-3 px-4 py-3 border border-border rounded-xl hover:border-primary/40 hover:bg-background transition-colors group"
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Link2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-secondary group-hover:text-primary transition-colors">
            Start a gift chain
          </p>
          <p className="text-xs text-muted">Gift it → pay it forward → repeat</p>
        </div>
        <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          10% off each link
        </span>
      </Link>

      {/* ── BLIND MATCH ENTRY ── */}
      <Link
        href={`/${locale}/blind-match`}
        className="flex items-center gap-3 px-4 py-3 bg-[#1A1A1A] rounded-xl hover:bg-[#2D2D2D] transition-colors group"
      >
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <Dices className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Send as a mystery gift</p>
          <p className="text-xs text-white/50">Recipient won&apos;t know what it is until it arrives</p>
        </div>
        <span className="text-xs font-semibold text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
          🎲 Blind
        </span>
      </Link>

      {/* ── STAR SELLER BADGE ── */}
      <StarSellerBadge title={t('starSeller.title')} description={t('starSeller.description')} />

      {/* ── ACCORDIONS ── */}
      <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <ItemDetailsAccordion product={product} />
        <ShippingReturnsAccordion product={product} />
        <PurchaseProtectionAccordion />
        <FAQsAccordion />
        <MeetYourSellersAccordion />
      </div>

      {/* ── MOBILE STICKY BAR (fixed, escapes column layout) ── */}
      <MobileStickyCartBar
        product={product}
        selectedVariant={selectedVariant}
        canAddToCart={canAddToCart}
        onAddToCart={handleAddToCart}
      />

    </div>
  );
}
