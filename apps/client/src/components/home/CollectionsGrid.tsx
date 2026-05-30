import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { CollectionDto } from '@mlh/types';

interface CollectionsGridProps {
  collections: CollectionDto[];
  locale: string;
}

export async function CollectionsGrid({ collections, locale }: CollectionsGridProps) {
  if (collections.length === 0) return null;

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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            href={`/${locale}/collections/${collection.slug}`}
            className="group relative overflow-hidden rounded-card aspect-[4/3] bg-muted block"
          >
            {collection.imageUrl ? (
              <Image
                src={collection.imageUrl}
                alt={collection.name}
                fill
                sizes="(max-width: 768px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
            )}

            {/* Gradient overlay — darkens on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent group-hover:from-black/80 transition-colors duration-300" />

            {/* Collection name */}
            <div className="absolute inset-0 flex items-end p-4 md:p-5">
              <div>
                <h3 className="font-display text-white font-bold text-lg md:text-xl leading-tight">
                  {collection.name}
                </h3>
                {collection.productCount !== undefined && collection.productCount > 0 && (
                  <p className="text-white/70 text-sm mt-0.5">
                    {t('collections.productCount', { count: collection.productCount })}
                  </p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
