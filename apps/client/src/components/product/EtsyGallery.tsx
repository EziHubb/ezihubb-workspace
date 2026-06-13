'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Heart, Flag, X } from 'lucide-react';
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

  const [activeIndex,  setActiveIndex]  = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const locale   = useLocale();
  const router   = useRouter();
  const pathname = usePathname();

  // ── Wishlist ──────────────────────────────────────────────────────────────────
  const isLoggedIn = Boolean(useAuthStore((s) => s.user));
  const { data: wishlistItems }               = useWishlist(isLoggedIn);
  const { addToWishlist, removeFromWishlist } = useMutateWishlist();
  const isInWishlist = wishlistItems?.some((item) => item.productId === product.id) ?? false;

  const handleWishlist = () => {
    if (!isLoggedIn) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (isInWishlist) removeFromWishlist.mutate(product.id);
    else              addToWishlist.mutate(product.id);
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

  // Keyboard navigation (only when lightbox is open)
  useEffect(() => {
    if (!lightboxOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'Escape')     setLightboxOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, lightboxOpen]);

  // Lock body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = lightboxOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxOpen]);

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
    <>
      {/* ── PAGE GALLERY ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3">

        {/* Vertical thumbnail strip (desktop only) */}
        <div className="hidden lg:flex flex-col gap-2 w-[76px] flex-shrink-0 overflow-y-auto max-h-[640px] [&::-webkit-scrollbar]:hidden">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`View image ${i + 1}`}
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

        {/* Main image area */}
        <div className="flex-1 min-w-0">

          {/* Main image — click to open lightbox */}
          <div
            className="relative aspect-square rounded-2xl overflow-hidden bg-[#F5F1EB] cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Wishlist button */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleWishlist(); }}
              aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              className="absolute top-3 right-3 z-10 w-9 h-9 bg-white rounded-full shadow flex items-center justify-center hover:scale-110 transition-transform"
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isInWishlist ? 'fill-red-500 text-red-500' : 'text-secondary'
                }`}
              />
            </button>

            <Image
              src={mainImage.url}
              alt={mainImage.altText ?? product.name}
              fill
              sizes="(max-width: 1024px) 100vw, calc(100vw - 476px)"
              priority
              className="object-cover"
            />

            {/* ◀ ▶ arrows */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goPrev(); }}
                  disabled={activeIndex === 0}
                  aria-label="Previous photo"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-white rounded-full shadow flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-secondary" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); goNext(); }}
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
                    onClick={(e) => { e.stopPropagation(); setActiveIndex(i); }}
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
            Report this item to DailyDaisy
          </button>
        </div>
      </div>

      {/* ── LIGHTBOX ─────────────────────────────────────────────────────────────── */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-stretch"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>

          {/* Inner container */}
          <div
            className="flex w-full max-w-[1200px] mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main image panel */}
            <div
              className="flex-1 flex items-center justify-center p-8 relative"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="relative w-full max-h-[80vh] aspect-square">
                <Image
                  src={mainImage.url}
                  alt={mainImage.altText ?? product.name}
                  fill
                  sizes="(max-width: 1200px) 70vw, 840px"
                  className="object-contain"
                  priority
                />
              </div>

              {/* Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={activeIndex === 0}
                    aria-label="Previous photo"
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6 text-secondary" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={activeIndex === images.length - 1}
                    aria-label="Next photo"
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition-colors"
                  >
                    <ChevronRight className="w-6 h-6 text-secondary" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail grid (right side) */}
            <div className="w-[300px] flex-shrink-0 overflow-y-auto py-12 pr-4 pl-2">
              <div className="grid grid-cols-2 gap-2">
                {images.map((img, i) => (
                  <button
                    key={img.id ?? i}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    aria-label={`View image ${i + 1}`}
                    className={[
                      'relative aspect-square rounded-lg overflow-hidden border-2 transition-all',
                      i === activeIndex
                        ? 'border-white opacity-100'
                        : 'border-transparent opacity-60 hover:opacity-90',
                    ].join(' ')}
                  >
                    <Image
                      src={img.url}
                      alt={img.altText ?? `${product.name} photo ${i + 1}`}
                      fill
                      sizes="130px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
