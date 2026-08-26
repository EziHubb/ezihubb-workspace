'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Star, ExternalLink } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, Button, Skeleton } from '@ezihubb/ui';
import { ProductGallery } from '../product/ProductGallery';
import { VariantPicker } from '../product/VariantPicker';
import type { FlexVariant, VariantOption } from '../product/VariantPicker';
import type { ProductDetailDto } from '@ezihubb/types';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtAmount, fmtRating } from '@ezihubb/utils';

// ── Loading skeleton ──────────────────────────────────────────────────────────

function QuickViewSkeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-5 animate-pulse">
      <div className="w-full md:w-[45%]">
        <Skeleton variant="rect" className="aspect-square w-full rounded-card" />
      </div>
      <div className="flex-1 space-y-4">
        <Skeleton variant="text" className="h-5 w-4/5" />
        <Skeleton variant="text" className="h-4 w-24" />
        <Skeleton variant="text" className="h-7 w-28" />
        <div className="space-y-2 pt-2">
          <Skeleton variant="text" className="h-3 w-full" />
          <Skeleton variant="text" className="h-3 w-5/6" />
          <Skeleton variant="text" className="h-3 w-3/4" />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rect" className="h-9 w-16 rounded-button" />
          ))}
        </div>
        <Skeleton variant="rect" className="h-11 w-full rounded-button" />
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface QuickViewModalProps {
  isOpen:       boolean;
  productSlug:  string;
  onClose:      () => void;
  onAddToCart?: (productId: string, variantId?: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function QuickViewModal({
  isOpen,
  productSlug,
  onClose,
  onAddToCart,
}: QuickViewModalProps) {
  const locale = useLocale();
  const t = useTranslations('product.quickView');
  const tSpecs = useTranslations('product.specs');
  const tCommon = useTranslations('common');

  const [product,          setProduct]          = useState<ProductDetailDto | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [selectedVariant,  setSelectedVariant]  = useState<FlexVariant | null>(null);
  const [error,            setError]            = useState('');

  useEffect(() => {
    if (!isOpen || !productSlug) return;

    setLoading(true);
    setProduct(null);
    setError('');

    apiClient
      .get<ProductDetailDto>(API_ROUTES.PRODUCTS.DETAIL(productSlug))
      .then((product) => setProduct(product))
      .catch((err: Error) => setError(err.message ?? t('notFound')))
      .finally(() => setLoading(false));
  }, [isOpen, productSlug]);

  const price = selectedVariant?.price ?? product?.basePrice ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader onClose={onClose} closeLabel={tCommon('close')}>
        {!loading && product ? product.name : tSpecs('title')}
      </ModalHeader>

      <ModalBody>
        {loading && <QuickViewSkeleton />}

        {!loading && error && (
          <div className="py-8 text-center">
            <p className="text-sm text-muted">{error}</p>
          </div>
        )}

        {!loading && product && (
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: Gallery (simplified — up to 2 images) */}
            <div className="w-full md:w-[45%] shrink-0">
              <ProductGallery
                images={(product.images ?? []).slice(0, 2)}
                productName={product.name}
                soldCount={product.soldCount}
              />
            </div>

            {/* Right: Product info */}
            <div className="flex-1 space-y-4 min-w-0">
              {/* Name */}
              <h2 className="font-display text-xl font-bold text-secondary leading-snug">
                {product.name}
              </h2>

              {/* Rating */}
              {product.reviewCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold text-secondary">
                    {fmtRating(product.averageRating ?? 0)}
                  </span>
                  <span className="text-xs text-muted">
                    ({t('reviewCount', { count: product.reviewCount })})
                  </span>
                </div>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-2">
                {/* Same rule as the card this modal opens from. */}
                <span className={['text-2xl font-bold', product.compareAtPrice && product.compareAtPrice > price ? 'text-badge-sale' : 'text-primary'].join(' ')}>
                  {fmtAmount(price)}
                </span>
                {product.compareAtPrice && product.compareAtPrice > price && (
                  <span className="text-sm text-muted line-through">
                    {fmtAmount(product.compareAtPrice)}
                  </span>
                )}
              </div>

              {/* Short description */}
              {product.shortDescription && (
                <p className="text-sm text-muted leading-relaxed line-clamp-3">
                  {product.shortDescription}
                </p>
              )}

              {/* Variant picker */}
              {product.variants && product.variants.length > 0 && (() => {
                // The backend already filters to isAvailable-only variants
                // before sending DETAIL — every row here is available.
                const flexVariants: FlexVariant[] = product.variants!.map((v) => ({
                  sku:       v.sku ?? v.id,
                  options:   v.options,
                  price:     v.price,
                  isDefault: v.isDefault,
                }));
                const optMap = new Map<string, Set<string>>();
                flexVariants.forEach((fv) => Object.entries(fv.options).forEach(([k, val]) => { if (!optMap.has(k)) optMap.set(k, new Set()); optMap.get(k)!.add(val); }));
                const variantOptions: VariantOption[] = Array.from(optMap.entries()).map(([name, values]) => ({ name, values: Array.from(values) }));
                return variantOptions.length > 0 ? (
                  <VariantPicker
                    variantOptions={variantOptions}
                    variants={flexVariants}
                    onVariantChange={setSelectedVariant}
                  />
                ) : null;
              })()}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <Link
                  href={`/${locale}/products/${productSlug}/customize`}
                  className="flex items-center justify-center w-full h-11 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors"
                  onClick={onClose}
                >
                  {t('personalizeAddToCart')}
                </Link>
                <Link
                  href={`/${locale}/products/${productSlug}`}
                  className="flex items-center justify-center gap-1.5 w-full h-10 border border-border rounded-button text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors"
                  onClick={onClose}
                >
                  {t('viewFullDetails')}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
