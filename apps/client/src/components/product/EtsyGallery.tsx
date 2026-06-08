'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Heart, Flag } from 'lucide-react';
import { useWishlist, useMutateWishlist } from '@mlh/api-client';
import { useAuthStore } from '../../lib/store/auth.store';
import type { ProductDto } from '@mlh/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLACEHOLDER = 'https://placehold.co/600x600/FFF5F0/E85D3F.png?text=No+Image';

// ── Props ─────────────────────────────────────────────────────────────────────

interface EtsyGalleryProps {
  product: ProductDto;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EtsyGallery({ product }: EtsyGalleryProps) {
  const images = product.images?.length
    ? product.images
    : [{ id: 'ph', url: PLACEHOLDER, altText: product.name, isPrimary: true, sortOrder: 0 }];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed,    setIsZoomed]    = useState(false);
  const [zoomPos,     setZoomPos]     = useState({ x: 50, y: 50 });

  const locale   = useLocale();
  const router   = useRouter();
  const pathname = usePathname();

  // ── Wishlist ─────────────────────────────────────────────────────────────────
  const isLoggedIn   = Boolean(useAuthStore((s) => s.user));
  const { data: wishlistItems }               = useWishlist(isLoggedIn);
  const { addToWishlist, removeFromWishlist } = useMutateWishlist();
  const isInWishlist = wishlistItems?.some((item) => item.productId === product.id) ?? false;

  const handleWishlist = () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (isInWishlist) {
      removeFromWishlist.mutate(product.id);
    } else {
      addToWishlist.mutate(product.id);
    }
  };

  // ── Navigation ────────────────────────────────────────────────────────────────
  const goNext = useCallback(
    () => setActiveIndex((i) => Math.min(i + 1, images.length - 1)),
    [images.length],
  );
  const goPrev = useCallback(
    () => setActiveIndex((i) => Math.max(i - 1, 0)),
    [],
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  // Touch swipe
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { if (diff > 0) goNext(); else goPrev(); }
  };

  const mainImage = images[activeIndex] ?? images[0];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-3">

      {/* ── VERTICAL THUMBNAIL STRIP (desktop only) ── */}
      <div className="hidden lg:flex flex-col gap-2 w-[76px] flex-shrink-0 overflow-y-auto max-h-[640px] [&::-webkit-scrollbar]:hidden">
        {images.map((img, i) => (
          <button
            key={img.id ?? i}
            type="button"
            onClick={() => setActiveIndex(i)}
            aria-label={`View image ${i + 1}`}
            aria-current={i === activeIndex ? 'true' : undefined}
            className={[
              'relative flex-shrink-0 aspect-square rounded-md overflow-hidden border-2 transition-colors',
              i === activeIndex
                ? 'border-secondary'
                : 'border-transparent hover:border-[#CCC]',
            ].join(' ')}
          >
            <Image
              src={img.url}
              alt={img.altText ?? `${product.name} photo ${i + 1}`}
              fill
              sizes="76px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {/* ── MAIN IMAGE AREA ── */}
      <div className="flex-1 min-w-0">

        {/* Main image + overlays */}
        <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#F5F1EB]">

          {/* ♡ Wishlist */}
          <button
            type="button"
            onClick={handleWishlist}
            aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            className="absolute top-3 right-3 z-10 w-9 h-9 bg-white rounded-full shadow flex items-center justify-center hover:scale-110 transition-transform"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${
                isInWishlist ? 'fill-red-500 text-red-500' : 'text-secondary'
              }`}
            />
          </button>

          {/* Main image with cursor-zoom + touch swipe */}
          <div
            className={`w-full h-full ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseMove={(e) => {
              if (!isZoomed) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setZoomPos({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              });
            }}
            onMouseEnter={() => setIsZoomed(true)}
            onMouseLeave={() => setIsZoomed(false)}
          >
            <Image
              src={mainImage.url}
              alt={mainImage.altText ?? product.name}
              fill
              sizes="(max-width: 1024px) 100vw, calc(100vw - 476px)"
              priority
              className={`object-cover transition-transform duration-100 ${
                isZoomed ? 'scale-[2]' : 'scale-100'
              }`}
              style={isZoomed
                ? { transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }
                : undefined}
            />
          </div>

          {/* ◀ ▶ arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                disabled={activeIndex === 0}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full shadow flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-secondary" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={activeIndex === images.length - 1}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full shadow flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-secondary" />
              </button>
            </>
          )}

          {/* Mobile dot indicators */}
          {images.length > 1 && (
            <div className="lg:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  aria-label={`View image ${i + 1}`}
                  className={`rounded-full transition-all ${
                    i === activeIndex ? 'w-3 h-1.5 bg-secondary' : 'w-1.5 h-1.5 bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Mobile horizontal thumbnail strip */}
        {images.length > 1 && (
          <div className="lg:hidden flex gap-2 mt-3 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {images.map((img, i) => (
              <button
                key={img.id ?? i}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`View image ${i + 1}`}
                className={[
                  'relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors',
                  i === activeIndex ? 'border-secondary' : 'border-transparent',
                ].join(' ')}
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? ''}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Report link */}
        <button
          type="button"
          className="mt-3 text-xs text-muted hover:underline flex items-center gap-1"
        >
          <Flag className="w-3 h-3" />
          Report this item to MapleLoomHandmade
        </button>
      </div>
    </div>
  );
}
