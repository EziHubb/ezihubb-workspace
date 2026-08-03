'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ProductImageDto } from '@ezihubb/types';

interface ProductGalleryProps {
  images:      ProductImageDto[];
  productName: string;
  soldCount?:  number;
}

const PLACEHOLDER = 'https://placehold.co/600x600/FFF5F0/E85D3F.png?text=No+Image';

export function ProductGallery({ images, productName, soldCount }: ProductGalleryProps) {
  const displayed =
    images.length > 0
      ? images
      : [{ id: 'ph', productId: '', url: PLACEHOLDER, altText: productName, isPrimary: true, sortOrder: 0 }];

  const [activeIdx, setActiveIdx] = useState(0);
  const touchStartX = useRef(0);

  const prev = () => setActiveIdx((i) => (i - 1 + displayed.length) % displayed.length);
  const next = () => setActiveIdx((i) => (i + 1) % displayed.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { if (diff > 0) next(); else prev(); }
  };

  const mainImage   = displayed[activeIdx] ?? displayed[0];
  const thumbnails  = displayed.slice(0, 5);
  const showBadge   = soldCount !== undefined && soldCount >= 10;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* "In demand" urgency badge */}
      {showBadge && (
        <div
          className="inline-flex items-center gap-1.5 self-start px-3 py-1 text-xs font-semibold rounded-pill bg-warning/10 border border-warning/25 text-warning"
          aria-live="polite"
        >
          🔥 {soldCount}+ bought recently
        </div>
      )}

      {/* ── Main image ──────────────────────────────────────────────────────── */}
      <div
        className="relative w-full aspect-square overflow-hidden rounded-card bg-background group cursor-zoom-in select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={mainImage.url}
          alt={mainImage.altText ?? productName}
          fill
          sizes="(max-width: 768px) 100vw, 55vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          priority
        />

        {/* Prev / Next arrows — desktop */}
        {displayed.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous image"
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full items-center justify-center shadow-sm hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-secondary" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next image"
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full items-center justify-center shadow-sm hover:bg-white transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-secondary" />
            </button>
          </>
        )}

        {/* Dot indicators — mobile */}
        {displayed.length > 1 && (
          <div className="md:hidden absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {displayed.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={`View image ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === activeIdx ? 'bg-primary w-3' : 'bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Thumbnail strip — desktop ────────────────────────────────────────── */}
      {thumbnails.length > 1 && (
        <div className="hidden md:flex gap-2" role="list" aria-label="Product images">
          {thumbnails.map((img, i) => (
            <button
              key={img.id ?? i}
              type="button"
              onClick={() => setActiveIdx(i)}
              role="listitem"
              aria-label={`View image ${i + 1}`}
              aria-current={i === activeIdx ? 'true' : undefined}
              className={[
                'relative w-16 h-16 flex-shrink-0 rounded-sm overflow-hidden border-2 transition-all duration-200',
                i === activeIdx
                  ? 'border-primary shadow-sm'
                  : 'border-transparent hover:border-primary/40',
              ].join(' ')}
            >
              <Image
                src={img.url}
                alt={img.altText ?? `Image ${i + 1}`}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
