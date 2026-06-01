'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCartStore } from '../../lib/store/cart.store';
import { CustomizerPanel } from '../customizer/CustomizerPanel';
import { BundleCustomizerPanel } from '../customizer/BundleCustomizerPanel';
import { DirectAddToCartPanel } from './DirectAddToCartPanel';
import { PersonalizationComingSoon } from './PersonalizationComingSoon';
import { DEMO_TEMPLATE } from '../../lib/customizer/types';
import type { ProductDto, ProductVariantDto } from '@mlh/types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProductActionsProps {
  product:         ProductDto;
  selectedVariant: ProductVariantDto | null;
  locale:          string;
}

// ── Flows ─────────────────────────────────────────────────────────────────────
//
//  A  isPersonalizable=true  AND customization != null  → CustomizerPanel
//  B  isPersonalizable=true  AND customization == null  → PersonalizationComingSoon
//  C  isPersonalizable=false                            → DirectAddToCartPanel

type Flow = 'A' | 'B' | 'C';

function detectFlow(product: ProductDto): Flow {
  if (!product.isPersonalizable) return 'C';
  if (product.customization)     return 'A';
  return 'B';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductActions({
  product,
  selectedVariant,
  locale,
}: ProductActionsProps) {
  const openDrawer  = useCartStore((s) => s.openDrawer);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('access_token'));
  }, []);

  const flow          = detectFlow(product);
  const effectivePrice =
    selectedVariant?.price !== undefined && selectedVariant.price > 0
      ? selectedVariant.price
      : product.basePrice;

  // ── Flow A: Full Customizer (single or bundle) ───────────────────────────
  if (flow === 'A') {
    const bundleCount = product.customization?.bundleCount ?? 1;

    // Bundle product → use BundleCustomizerPanel
    if (bundleCount > 1) {
      return (
        <BundleCustomizerPanel
          product={product}
          bundleCount={bundleCount}
          onCartSuccess={openDrawer}
        />
      );
    }

    // Single-item customizable product → use regular CustomizerPanel
    const template = DEMO_TEMPLATE;

    return (
      <>
        {/* Desktop: inline customizer */}
        <div className="hidden md:block">
          <CustomizerPanel
            template={template}
            productId={product.id}
            productName={product.name}
            basePrice={effectivePrice}
            locale={locale}
            variantId={selectedVariant?.sku ?? null}
            isLoggedIn={isLoggedIn}
            onCartSuccess={openDrawer}
          />
        </div>

        {/* Mobile: deep-link to the full customizer page */}
        <div className="md:hidden">
          <Link
            href={`/${locale}/products/${product.slug}/customize`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
          >
            Personalize &amp; Add to Cart
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </>
    );
  }

  // ── Flow B: Personalization Coming Soon ───────────────────────────────────
  if (flow === 'B') {
    return (
      <PersonalizationComingSoon
        product={product}
        selectedVariant={selectedVariant}
      />
    );
  }

  // ── Flow C: Direct Add to Cart ────────────────────────────────────────────
  return (
    <DirectAddToCartPanel
      product={product}
      selectedVariant={selectedVariant}
    />
  );
}
