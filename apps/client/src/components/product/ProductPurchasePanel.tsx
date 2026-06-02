'use client';

import { useState, useMemo } from 'react';
import {
  Star, CheckCircle2, Clock, ShoppingCart,
  Loader2, Plus, ChevronDown,
} from 'lucide-react';
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
  return (
    <div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-bold text-secondary">
          ${price.toFixed(2)}
        </span>
        {compareAtPrice && compareAtPrice > price && (
          <span className="text-base text-muted line-through">
            ${compareAtPrice.toFixed(2)}
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
}: {
  label:    string;
  values:   string[];
  selected: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className={[
            'w-full appearance-none border rounded-lg px-3 py-2.5 text-sm bg-white pr-8',
            'cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20',
            selected
              ? 'border-primary text-secondary'
              : 'border-border text-muted',
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
}: {
  value:    number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <label className="text-sm font-medium block mb-1.5">Quantity</label>
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
}: {
  fields:   CustomField[];
  isOpen:   boolean;
  onToggle: () => void;
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
        Add personalization
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

function StarSellerBadge() {
  return (
    <div className="flex gap-3 p-3 border border-border rounded-xl bg-[#FAFAF8]">
      <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
        <Star className="w-5 h-5 text-primary fill-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold">Star Seller</p>
        <p className="text-xs text-muted mt-0.5">
          This seller consistently earned 5-star reviews, shipped on time,
          and replied quickly to any messages they received.
        </p>
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
  const [selectedOptions,       setSelectedOptions]       = useState<Record<string, string>>({});
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [isAdding,              setIsAdding]              = useState(false);
  const [quantity,              setQuantity]              = useState(1);

  const addItem    = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

  // ── Variant resolution ────────────────────────────────────────────────────

  const selectedVariant = useMemo(() => {
    if (!product.variants?.length) return null;
    return (
      product.variants.find((v) =>
        Object.entries(selectedOptions).every(([k, val]) => v.options[k] === val),
      ) ?? null
    );
  }, [selectedOptions, product.variants]);

  const currentPrice   = selectedVariant?.price ?? product.basePrice;
  const compareAtPrice = selectedVariant?.compareAtPrice ?? product.compareAtPrice;
  const discountPercent =
    compareAtPrice && compareAtPrice > currentPrice
      ? Math.round((1 - currentPrice / compareAtPrice) * 100)
      : null;

  const variantCount  = product.variantOptions?.length ?? 0;
  const canAddToCart  =
    variantCount === 0 ||
    Object.keys(selectedOptions).length === variantCount;

  const customFields = product.customization?.fields ?? [];

  // ── Add to cart ───────────────────────────────────────────────────────────

  const handleAddToCart = async () => {
    if (!canAddToCart || isAdding) return;
    setIsAdding(true);
    try {
      await addItem({
        productId:         product.id,
        variantId:         selectedVariant?.sku ?? null,
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
          MapleLoom&apos;s Pick
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

      {/* ── RATING ROW ── */}
      {reviewSummary && reviewSummary.totalReviews > 0 && (
        <RatingRow
          averageRating={reviewSummary.averageRating}
          totalReviews={reviewSummary.totalReviews}
        />
      )}

      {/* ── VARIANT DROPDOWNS ── */}
      {variantCount > 0 && (
        <div className="space-y-3">
          {product.variantOptions!.map((opt) => (
            <VariantDropdown
              key={opt.name}
              label={opt.name}
              values={opt.values}
              selected={selectedOptions[opt.name] ?? ''}
              onChange={(v) =>
                setSelectedOptions((prev) => ({ ...prev, [opt.name]: v }))
              }
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
        />
      )}

      {/* ── QUANTITY ── */}
      <QuantityDropdown value={quantity} onChange={setQuantity} />

      {/* ── ADD TO CART ── */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={!canAddToCart || isAdding}
        className={[
          'w-full py-3.5 rounded-full font-semibold text-sm transition-all',
          'flex items-center justify-center gap-2',
          canAddToCart
            ? 'bg-primary text-white hover:bg-primary-dark active:scale-[0.98]'
            : 'bg-gray-200 text-muted cursor-not-allowed',
        ].join(' ')}
      >
        {isAdding ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Adding…
          </>
        ) : !canAddToCart ? (
          'Select options to continue'
        ) : (
          <>
            <ShoppingCart className="w-4 h-4" />
            Add to cart
          </>
        )}
      </button>

      {/* ── STAR SELLER BADGE ── */}
      <StarSellerBadge />

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
