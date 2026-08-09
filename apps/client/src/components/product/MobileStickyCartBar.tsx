'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { ProductDto, ProductVariantDto } from '@ezihubb/types';
import { fmtAmount } from '@ezihubb/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACEHOLDER = 'https://placehold.co/48x48/F5F1EB/999.png?text=?';
const SCROLL_THRESHOLD = 600;

// ── Props ─────────────────────────────────────────────────────────────────────

interface MobileStickyCartBarProps {
  product:         ProductDto;
  selectedVariant: ProductVariantDto | null;
  canAddToCart:    boolean;
  onAddToCart:     () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MobileStickyCartBar({
  product,
  selectedVariant,
  canAddToCart,
  onAddToCart,
}: MobileStickyCartBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = () => setIsVisible(window.scrollY > SCROLL_THRESHOLD);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const price     = selectedVariant?.price ?? product.basePrice;
  const imageUrl  = product.images?.[0]?.url ?? PLACEHOLDER;

  return (
    <div
      className={[
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'bg-white border-t border-border shadow-lg px-4 py-3',
        'transition-transform duration-300',
        isVisible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
      style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      aria-hidden={!isVisible}
    >
      <div className="flex items-center gap-3 max-w-lg mx-auto">

        {/* Product thumbnail */}
        <Image
          src={imageUrl}
          alt={product.name}
          width={48}
          height={48}
          className="rounded-lg object-cover flex-shrink-0"
        />

        {/* Name + price */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-secondary tabular-nums">
            {fmtAmount(price)}
          </p>
          <p className="text-xs text-muted truncate">{product.name}</p>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onAddToCart}
          className="px-5 py-2.5 rounded-full text-sm font-semibold flex-shrink-0 transition-colors bg-primary text-white hover:bg-primary-dark active:scale-[0.97]"
        >
          Add to cart
        </button>

      </div>
    </div>
  );
}
