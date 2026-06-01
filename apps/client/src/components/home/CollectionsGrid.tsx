import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { CollectionDto } from '@mlh/types';
import { ArrowRight } from 'lucide-react';

interface CollectionsGridProps {
  collections: CollectionDto[];
  locale: string;
}

// Deterministic gradient based on collection name — shown when no image is available
function collectionGradient(name: string): string {
  const hue = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 55%, 70%)`;
}

export async function CollectionsGrid({ collections, locale }: CollectionsGridProps) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-16 md:py-20">
      <div className="text-center mb-10 md:mb-12">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-3">
          {t('collections.title')}
        </h2>
        <p className="text-muted text-base md:text-lg">{t('collections.subtitle')}</p>
      </div>

      {/* 3×2 grid on desktop, 2×3 on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-8">
        {collections.length === 0
          ? // Skeleton placeholder — 6 gray cards while loading / API failed
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-card aspect-[4/3] bg-border/40 animate-pulse"
                aria-hidden="true"
              />
            ))
          : collections.map((collection) => {
              // Prefer bannerUrl (new spec), fall back to imageUrl (legacy)
              const imgSrc = collection.bannerUrl ?? collection.imageUrl;
              const productCount =
                collection._count?.products ?? collection.productCount;

              return (
                <Link
                  key={collection.id}
                  href={`/${locale}/collections/${collection.slug}`}
                  className="group relative overflow-hidden rounded-card aspect-[4/3] block"
                  style={
                    !imgSrc
                      ? { background: `linear-gradient(135deg, ${collectionGradient(collection.name)}, ${collectionGradient(collection.name + '2')})` }
                      : undefined
                  }
                >
                  {imgSrc ? (
                    <Image
                      src={imgSrc}
                      alt={collection.name}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-black/10" />
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent group-hover:from-black/80 transition-colors duration-300" />

                  {/* Collection name */}
                  <div className="absolute inset-0 flex items-end p-4 md:p-5">
                    <div>
                      <h3 className="font-display text-white font-bold text-lg md:text-xl leading-tight">
                        {collection.name}
                      </h3>
                      {productCount !== undefined && productCount > 0 && (
                        <p className="text-white/70 text-sm mt-0.5">
                          {t('collections.productCount', { count: productCount })}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>

      <div className="text-center">
        <Link
          href={`/${locale}/occasions`}
          className="inline-flex items-center gap-1.5 text-primary hover:text-primary-dark font-medium text-sm transition-colors"
        >
          {t('collections.viewAllOccasions')}
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
}
