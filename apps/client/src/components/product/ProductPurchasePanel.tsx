'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import {
  Star, CheckCircle2, Clock, ShoppingCart,
  Loader2, Plus, ChevronDown, Users,
} from 'lucide-react';
import { ShareButton } from './ShareButton';
import {
  ItemDetailsAccordion,
  ShippingReturnsAccordion,
  DigitalDeliveryAccordion,
  PurchaseProtectionAccordion,
  FAQsAccordion,
  MeetYourSellersAccordion,
} from './ProductAccordions';
import { useCartStore } from '../../lib/store/cart.store';
import { MobileStickyCartBar } from './MobileStickyCartBar';
import { toast } from '../../lib/store/toast.store';
import { useCurrency } from '../../lib/currency/currency-context';
import { analytics } from '../../lib/analytics';
import type { ProductDetailDto, ProductVariantDto, ReviewSummaryDto } from '@ezihubb/types';
import { fmtRating, safeNum } from '@ezihubb/utils';
import { useVariationPhoto } from './VariationPhotoContext';

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

function fmtDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

// Sellers often enter variant option names/values in ALL CAPS ("SIZE",
// "ADULT TEE - XS") — display-only transform, the raw string is still what's
// used for matching/selection everywhere else.
//
// Size tokens are preserved rather than title-cased. A plain title-case turns
// "XS" into "Xs" and "2XL" into "2xl", which is wrong on the one variant almost
// every apparel listing has — the shopper picks a size from this dropdown, and
// "2xl" reads like a typo. A token is left alone when it is already all-caps
// and either contains a digit ("2XL", "3XL") or is built only from the letters
// sizes use ("S", "XL", "XXL", "XXXL").
//
// Deliberately narrow. It does not try to protect every acronym — "USB-C" still
// becomes "Usb-c" — because guessing which all-caps words are meaningful in
// free text is not solvable, and sizes are the case that actually occurs here.
function toTitleCase(s: string): string {
  return s.replace(/\S+/g, (word) => {
    const isAllCaps = word === word.toUpperCase() && /[A-Z]/.test(word);
    if (isAllCaps && (/\d/.test(word) || /^[XSML]{1,4}$/.test(word))) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

// ── Field type from ProductDetailDto['customization'] ───────────────────────────────

type CustomField = NonNullable<ProductDetailDto['customization']>['fields'][number];

// ── InDemandBadge ─────────────────────────────────────────────────────────────

function InDemandBadge({ count }: { count: number }) {
  const t = useTranslations('product.purchasePanel');
  return (
    <div className="flex items-center gap-2 text-sm text-secondary">
      <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
      <span>
        {t.rich('boughtInDemand', { count, strong: (chunks) => <strong>{chunks}</strong> })}
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
  const t = useTranslations('product.purchasePanel');
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
            {t('discountOff', { percent: discountPercent })}
          </span>
        )}
      </div>
      {discountPercent !== null && discountPercent > 0 && (
        <p className="text-xs text-muted mt-0.5">{t('limitedTimeSale')}</p>
      )}
    </div>
  );
}

// ── BuyTogetherCard ──────────────────────────────────────────────────────────

function BuyTogetherCard({
  bundleOffer,
  currentProductId,
  onAdded,
}: {
  bundleOffer: NonNullable<ProductDetailDto['bundleOffer']>;
  currentProductId: string;
  onAdded: () => void;
}) {
  const t = useTranslations('product.purchasePanel');
  const { format } = useCurrency();
  const addItem = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const [isAdding, setIsAdding] = useState(false);

  const partners = bundleOffer.products.filter((p) => p.id !== currentProductId);
  if (partners.length === 0) return null;

  const originalTotal = bundleOffer.products.reduce((sum, p) => sum + p.price, 0);
  const bundleTotal = Math.round(originalTotal * (1 - bundleOffer.discountPercent / 100) * 100) / 100;

  const handleAddBundle = async () => {
    setIsAdding(true);
    try {
      await Promise.all([
        addItem({ productId: currentProductId, variantId: null, quantity: 1, customizationData: null }),
        ...partners.map((p) => addItem({ productId: p.id, variantId: null, quantity: 1, customizationData: null })),
      ]);
      openDrawer();
      onAdded();
    } catch {
      toast.error(t('couldNotAddToCart'));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="border border-primary/20 bg-primary/[0.03] rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
        <Users className="w-4 h-4 text-primary" />
        {t('buyTogether', { percent: bundleOffer.discountPercent })}
      </div>

      <div className="flex items-center gap-2">
        {bundleOffer.products.map((p) => (
          p.images[0]
            ? <img key={p.id} src={p.images[0]} alt={p.name} className="w-12 h-12 rounded-lg object-cover border border-border" />
            : <div key={p.id} className="w-12 h-12 rounded-lg bg-background border border-border" />
        ))}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-secondary">{format(bundleTotal)}</span>
        <span className="text-sm text-muted line-through">{format(originalTotal)}</span>
      </div>

      <button
        type="button"
        onClick={handleAddBundle}
        disabled={isAdding}
        className="w-full py-2.5 rounded-full font-semibold text-sm bg-secondary text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isAdding ? t('actions.adding') : t('addBundleToCart')}
      </button>
    </div>
  );
}

// ── DeliveryInfo ──────────────────────────────────────────────────────────────

function DeliveryInfo({ processingDays }: { processingDays: number }) {
  const t      = useTranslations('product.purchasePanel');
  const locale = useLocale();
  const today       = new Date();
  const shipBy      = addBusinessDays(today, processingDays);
  const deliveryMin = addCalendarDays(shipBy, 5);
  const deliveryMax = addCalendarDays(shipBy, 10);

  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center gap-2 text-secondary">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span>{t('freeShipping')}</span>
      </div>
      <div className="flex items-center gap-2 text-secondary">
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span>
          {t.rich('arrivesSoon', {
            min: fmtDate(deliveryMin, locale),
            max: fmtDate(deliveryMax, locale),
            strong: (chunks) => <strong>{chunks}</strong>,
          })}
        </span>
      </div>
      <div className="flex items-center gap-2 text-secondary">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span>{t('returnsAccepted')}</span>
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
  const t = useTranslations('product.info');
  const rounded = Math.round(safeNum(averageRating));
  return (
    <a href="#reviews" className="flex items-center gap-1.5 text-sm hover:underline w-fit">
      <span className="font-semibold">{fmtRating(averageRating)}</span>
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
      <span className="text-muted">({t('reviewCount', { count: safeNum(totalReviews) })})</span>
    </a>
  );
}

// ── VariantDropdown ───────────────────────────────────────────────────────────

// Variants carry a price per full option combination, not per single option
// value — so "Embroidered Hat (510,193đ)" only resolves to one number when
// every OTHER already-picked group narrows it down to a single price. With
// groups still unpicked (or a group, like Size here, that spans many prices),
// show the min–max range across the matching variants instead of a false-
// precise single figure.
function priceRangeForValue(
  variants:    ProductVariantDto[],
  optionName:  string,
  value:       string,
  allSelected: Record<string, string>,
): { min: number; max: number } | null {
  const matches = variants.filter((v) => {
    if (v.options?.[optionName] !== value) return false;
    return Object.entries(allSelected).every(
      ([k, val]) => k === optionName || !val || v.options?.[k] === val,
    );
  });
  if (matches.length === 0) return null;
  const prices = matches.map((v) => v.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function VariantDropdown({
  label,
  optionName,
  values,
  selected,
  onChange,
  hasError,
  id,
  variants,
  allSelected,
}: {
  label:    string;
  optionName: string;
  values:   string[];
  selected: string;
  onChange: (v: string) => void;
  hasError?: boolean;
  id?:       string;
  variants:   ProductVariantDto[];
  allSelected: Record<string, string>;
}) {
  const t = useTranslations('product.purchasePanel');
  const { format } = useCurrency();

  const priceLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const v of values) {
      const range = priceRangeForValue(variants, optionName, v, allSelected);
      if (!range) continue;
      labels[v] = range.min === range.max
        ? format(range.min)
        : `${format(range.min)}–${format(range.max)}`;
    }
    return labels;
  }, [values, variants, optionName, allSelected, format]);

  return (
    <div id={id}>
      <label className="text-sm font-medium block mb-1.5">
        {toTitleCase(label)} <span className="text-red-500">*</span>
      </label>
      {hasError && !selected && (
        <p className="text-xs text-red-500 mb-1">{t('pleaseSelectOption')}</p>
      )}
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => onChange(e.target.value)}
          className={[
            'w-full appearance-none border rounded-[8px] px-3 py-2.5 text-sm bg-white pr-8',
            'cursor-pointer transition-colors focus:outline-none focus:ring-2',
            selected
              ? 'border-primary text-secondary focus:ring-primary/20'
              : hasError
                ? 'border-red-400 text-muted focus:ring-red-200 bg-red-50'
                : 'border-border text-muted focus:ring-primary/20',
          ].join(' ')}
        >
          <option value="">{t('selectOptionPlaceholder')}</option>
          {values.map((v) => (
            <option key={v} value={v}>
              {priceLabels[v] ? `${toTitleCase(v)} (${priceLabels[v]})` : toTitleCase(v)}
            </option>
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
          className="w-full appearance-none border border-border rounded-[8px] px-3 py-2.5 text-sm bg-white pr-8 cursor-pointer text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
  const t = useTranslations('common');
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
                    <option value="">{t('selectEllipsis')}</option>
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
  product:       ProductDetailDto;
  reviewSummary: ReviewSummaryDto | null;
  locale?:       string;
}

export function ProductPurchasePanel({ product, reviewSummary }: Props) {
  const t      = useTranslations('product');
  const tPanel = useTranslations('product.purchasePanel');
  const [selectedOptions,       setSelectedOptions]       = useState<Record<string, string>>({});
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [isAdding,              setIsAdding]              = useState(false);
  const [quantity,              setQuantity]              = useState(1);
  const [hasAttemptedSubmit,    setHasAttemptedSubmit]    = useState(false);

  const addItem    = useCartStore((s) => s.addItem);
  const openDrawer = useCartStore((s) => s.openDrawer);

  const { focusImage }   = useVariationPhoto();
  const variationPhotos  = product.variationPhotos;

  // Fire viewItem once on mount
  useEffect(() => {
    analytics.viewItem({
      id:       product.id,
      name:     product.name,
      category: product.category.name,
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

  // Before a full option combination is picked, fall back to the cheapest real
  // variant price rather than product.basePrice — basePrice is seller-entered
  // and never auto-synced to per-variant prices, so it can silently disagree
  // with what the product actually costs once variants exist.
  const minVariantPrice = useMemo(
    () => (product.variants?.length ? Math.min(...product.variants.map((v) => v.price)) : undefined),
    [product.variants],
  );
  const rawPrice        = selectedVariant?.price ?? minVariantPrice ?? product.basePrice;
  // No per-variant compareAtPrice exists (ProductVariant has no such column —
  // see ProductVariantDto) — only the product-level one.
  const rawCompareAtPrice = product.compareAtPrice ?? undefined;

  // Etsy "Set up a sale" — applied to whichever price is currently selected
  // (base or variant), same math as the server (checkout recomputes this
  // itself regardless, so this is purely a display preview).
  const salePromo = product.salePromo;
  const currentPrice = useMemo(() => {
    if (!salePromo) return rawPrice;
    const discounted = salePromo.type === 'PERCENTAGE'
      ? rawPrice - Math.round(rawPrice * salePromo.value) / 100
      : Math.max(0, rawPrice - salePromo.value);
    return Math.round(Math.max(0, discounted) * 100) / 100;
  }, [rawPrice, salePromo]);
  // The sale price becomes the new "current price", so the original
  // (seller's own price, or their manually-set compareAtPrice if higher)
  // becomes the struck-through reference.
  const compareAtPrice = salePromo
    ? Math.max(rawPrice, rawCompareAtPrice ?? 0) || rawPrice
    : rawCompareAtPrice;
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
        toast.error(tPanel('combinationNotAvailable'));
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
        toast.error(tPanel('selectRequiredOptions'));
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
      // No success toast here: the drawer slides open showing the item, its
      // quantity and the new subtotal, which says everything the toast said and
      // proves it rather than asserting it. The toast also rendered on top of
      // the drawer's own heading, so the two pieces of feedback fought for the
      // same corner of the screen.
      //
      // Kept on the paths that do NOT open the drawer (BuyTogetherCard and both
      // wishlist flows) — there the toast is the only sign anything happened.
      openDrawer();
    } catch {
      toast.error(tPanel('couldNotAddToCart'));
    } finally {
      setIsAdding(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="lg:sticky lg:top-4 space-y-3">

      {/* ── IN-DEMAND BADGE ── */}
      {(product.inDemandCount ?? 0) >= 2 && (
        <InDemandBadge count={product.inDemandCount!} />
      )}

      {/* ── FEATURED BADGE ── */}
      {product.isFeatured && (
        <div className="inline-flex items-center gap-1.5 bg-[#FFF0EC] text-primary text-xs font-medium px-2.5 py-1 rounded-full">
          <Star className="w-3 h-3 fill-primary" />
          {tPanel('editorsPick')}
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
      {/* Digital: Etsy shows nothing inline here — "Instant Download" only
          appears in the Delivery accordion below, alongside "Digital
          download" in Item details' highlights. */}
      {product.productType !== 'DIGITAL' && (
        <DeliveryInfo processingDays={product.processingDays ?? 3} />
      )}

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
              optionName={opt.name}
              values={opt.values}
              selected={selectedOptions[opt.name] ?? ''}
              onChange={(v) => {
                setSelectedOptions((prev) => ({ ...prev, [opt.name]: v }));
                // Only the one variation the seller linked photos to moves the
                // gallery, and only for options that actually have one — an
                // unlinked option leaves the shopper on the slide they were
                // already looking at rather than snapping back to the first.
                if (variationPhotos?.groupName === opt.name) {
                  const imageId = variationPhotos.imageIdByValue[v];
                  if (imageId) focusImage(imageId);
                }
              }}
              hasError={hasAttemptedSubmit && !selectedOptions[opt.name]}
              variants={product.variants}
              allSelected={selectedOptions}
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

      {/* ── BUY THEM TOGETHER ── */}
      {product.bundleOffer && (
        <BuyTogetherCard
          bundleOffer={product.bundleOffer}
          currentProductId={product.id}
          onAdded={() => toast.success(t('actions.addedToCart'))}
        />
      )}

      {/* ── STAR SELLER BADGE ── */}
      <StarSellerBadge title={t('starSeller.title')} description={t('starSeller.description')} />

      {/* ── ACCORDIONS ── */}
      <div className="border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <ItemDetailsAccordion product={product} />
        {product.productType === 'DIGITAL'
          ? <DigitalDeliveryAccordion />
          : <ShippingReturnsAccordion product={product} />}
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
