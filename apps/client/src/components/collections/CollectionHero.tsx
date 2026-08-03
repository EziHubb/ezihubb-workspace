'use client';

import Image from 'next/image';
import type { CollectionDto } from '@ezihubb/types';

export interface CollectionHeroProps {
  collection:   CollectionDto & { bannerUrl?: string };
  productCount: number;
}

export function CollectionHero({ collection, productCount }: CollectionHeroProps) {
  const bannerUrl = collection.bannerUrl ?? (collection as { imageUrl?: string }).imageUrl;

  return (
    <div className="relative h-[320px] md:h-[400px] overflow-hidden">
      {/* Background image or coral gradient fallback */}
      {bannerUrl ? (
        <Image
          src={bannerUrl}
          alt={collection.name}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-primary-dark/80" />
      )}

      {/* Dark gradient overlay — bottom to transparent */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

      {/* Content — bottom-left */}
      <div className="absolute inset-0 flex items-end">
        <div className="max-w-[1440px] w-full mx-auto px-4 md:px-8 pb-8 md:pb-10">
          {/* Eyebrow */}
          <p className="text-white/70 text-xs font-semibold tracking-[0.15em] uppercase mb-2">
            Collection
          </p>

          {/* Title */}
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-3 max-w-2xl">
            {collection.name}
          </h1>

          {/* Description */}
          {collection.description && (
            <p className="text-white/80 text-sm md:text-base max-w-xl leading-relaxed mb-3 line-clamp-2">
              {collection.description}
            </p>
          )}

          {/* Product count row */}
          <div className="flex items-center gap-4">
            <span className="text-white/70 text-sm">
              {productCount} {productCount === 1 ? 'product' : 'products'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
