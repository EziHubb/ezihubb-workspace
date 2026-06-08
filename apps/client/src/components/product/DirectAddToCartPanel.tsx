'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ShoppingCart, Heart, Truck, Clock, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCartStore } from '../../lib/store/cart.store';
import { useWishlist, useMutateWishlist } from '@mlh/api-client';
import { useAuthStore } from '../../lib/store/auth.store';
import type { ProductDto, ProductVariantDto, ProductAttributeDto } from '@mlh/types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface DirectAddToCartPanelProps {
  product:         ProductDto;
  selectedVariant: ProductVariantDto | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DirectAddToCartPanel({
  product,
  selectedVariant,
}: DirectAddToCartPanelProps) {
  const t        = useTranslations('product');
  const locale   = useLocale();
  const router   = useRouter();
  const pathname = usePathname();

  const { addItem }                         = useCartStore();
  const openDrawer                          = useCartStore((s) => s.openDrawer);
  const [quantity, setQuantity]             = useState(1);
  const [isAdding,  setIsAdding]            = useState(false);
  const [addError,  setAddError]            = useState('');

  // Wishlist
  const isLoggedIn   = Boolean(useAuthStore((s) => s.user));
  const { data: wishlistItems }             = useWishlist(isLoggedIn);
  const { addToWishlist, removeFromWishlist } = useMutateWishlist();
  const isWishlisted = wishlistItems?.some((i) => i.productId === product.id) ?? false;

  // Debounced quantity ref to avoid spamming
  const qtyRef = useRef(quantity);
  useEffect(() => { qtyRef.current = quantity; }, [quantity]);

  // Disable Add to Cart when a variant picker is rendered but nothing selected.
  // Mirror SmartVariantPicker's guard: it renders only when BOTH variantOptions
  // and variants are non-empty. If either is absent the picker never mounts and
  // selectedVariant stays null, so we must not gate the button on it.
  const hasVariants   = (product.variantOptions?.length ?? 0) > 0 && (product.variants?.length ?? 0) > 0;
  const needsVariant  = hasVariants && !selectedVariant;
  const isOutOfStock  = selectedVariant?.isAvailable === false;
  const effectivePrice =
    selectedVariant?.price !== undefined && selectedVariant.price > 0
      ? selectedVariant.price
      : product.basePrice;

  const handleAddToCart = async () => {
    if (needsVariant || isOutOfStock) return;
    setIsAdding(true);
    setAddError('');
    try {
      await addItem({
        productId:         product.id,
        variantId:         selectedVariant?.sku ?? null,
        quantity:          qtyRef.current,
        customizationData: null,
      });
      openDrawer();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add to cart');
    } finally {
      setIsAdding(false);
    }
  };

  const handleWishlist = () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (isWishlisted) {
      removeFromWishlist.mutate(product.id);
    } else {
      addToWishlist.mutate(product.id);
    }
  };

  // Extract filterable attributes for highlights
  const highlights = (product.attributes ?? [])
    .filter((a: ProductAttributeDto) => a.filterable)
    .slice(0, 4);

  return (
    <div className="space-y-4">
      {/* ── Quantity control ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-secondary">
          {t('actions.quantity')}
        </span>

        <div
          className="inline-flex items-center border border-border rounded-button overflow-hidden"
          style={{ width: 120 }}
          role="group"
          aria-label={t('actions.quantity')}
        >
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="w-10 h-10 flex items-center justify-center text-muted hover:text-secondary hover:bg-muted/5 transition-colors disabled:opacity-40"
          >
            −
          </button>
          <input
            type="number"
            value={quantity}
            min={1}
            max={99}
            aria-label="Quantity"
            onChange={(e) => {
              const v = Math.min(99, Math.max(1, Number(e.target.value) || 1));
              setQuantity(v);
            }}
            className="flex-1 h-10 text-center text-sm font-semibold text-secondary bg-transparent border-x border-border focus:outline-none tabular-nums"
          />
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            disabled={quantity >= 99}
            className="w-10 h-10 flex items-center justify-center text-muted hover:text-secondary hover:bg-muted/5 transition-colors disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {addError && (
        <p className="text-sm text-error" role="alert">{addError}</p>
      )}

      {/* ── Add to Cart button ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleAddToCart}
        disabled={isAdding || needsVariant || isOutOfStock}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
      >
        {isAdding ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Adding…
          </>
        ) : isOutOfStock ? (
          'Out of Stock'
        ) : (
          <>
            <ShoppingCart className="w-4 h-4" />
            {t('actions.addToCart')} — ${(effectivePrice * quantity).toFixed(2)}
          </>
        )}
      </button>

      {/* ── Wishlist ──────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleWishlist}
        className={[
          'w-full flex items-center justify-center gap-2 py-3 rounded-button border text-sm font-medium transition-colors',
          isWishlisted
            ? 'border-primary/30 text-primary bg-primary/5 hover:bg-primary/10'
            : 'border-border text-secondary hover:border-primary hover:text-primary',
        ].join(' ')}
      >
        <Heart
          className="w-4 h-4"
          fill={isWishlisted ? 'currentColor' : 'none'}
          stroke="currentColor"
        />
        {isWishlisted ? t('actions.removeFromWishlist') : t('actions.addToWishlist')}
      </button>

      {/* ── Trust signals ─────────────────────────────────────────────────── */}
      <ul className="space-y-1.5 text-xs text-muted pt-1">
        <li className="flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-primary shrink-0" />
          Ships in {product.processingDays ?? 3}–{(product.processingDays ?? 3) + 2} business days
        </li>
        <li className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-warning shrink-0" />
          Cancel within 2 hours of ordering
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0" />
          Secure checkout
        </li>
      </ul>

      {/* ── Product highlights (filterable attributes) ────────────────────── */}
      {highlights.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border">
          {highlights.map((attr: ProductAttributeDto) => (
            <span key={attr.key} className="text-xs text-secondary">
              <span className="text-success mr-1">✓</span>
              {attr.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
