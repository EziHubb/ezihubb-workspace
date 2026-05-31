import Image from 'next/image';
import Link from 'next/link';
import type { CollectionDto } from '@mlh/types';

export interface RelatedCollectionsProps {
  collections:  CollectionDto[];
  currentSlug:  string;
  locale:       string;
}

export function RelatedCollections({
  collections,
  currentSlug,
  locale,
}: RelatedCollectionsProps) {
  const related = collections
    .filter((c) => c.isActive && c.slug !== currentSlug)
    .slice(0, 4);

  if (related.length === 0) return null;

  return (
    <section className="bg-surface border-t border-border py-12 md:py-16 mt-4">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <h2 className="font-display text-2xl font-bold text-secondary mb-6">
          More Collections
        </h2>

        {/* Mobile: horizontal scroll, Desktop: 4-col grid */}
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-none lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
          {related.map((col) => {
            const imgSrc = (col as { bannerUrl?: string; imageUrl?: string }).bannerUrl
              ?? (col as { imageUrl?: string }).imageUrl;

            return (
              <Link
                key={col.id}
                href={`/${locale}/collections/${col.slug}`}
                className="group relative overflow-hidden rounded-card shrink-0 snap-start
                           w-[160px] h-[100px] md:w-[240px] md:h-[140px]
                           lg:w-auto lg:h-auto lg:aspect-[12/7] bg-muted block"
              >
                {imgSrc ? (
                  <Image
                    src={imgSrc}
                    alt={col.name}
                    fill
                    sizes="(max-width: 1024px) 240px, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent group-hover:from-black/75 transition-colors duration-300" />

                {/* Collection name */}
                <div className="absolute inset-0 flex items-end p-3 md:p-4">
                  <h5 className="font-display text-white font-bold text-xs md:text-sm leading-tight line-clamp-2">
                    {col.name}
                  </h5>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
