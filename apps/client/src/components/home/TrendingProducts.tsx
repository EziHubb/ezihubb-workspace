import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ProductCard, ProductCardSkeleton } from '@mlh/ui';
import type { ProductListItemDto } from '@mlh/types';

interface TrendingProductsProps {
  products: ProductListItemDto[];
  locale: string;
  viewAllLabel: string;
}

function deriveBadge(product: ProductListItemDto) {
  if (product.soldCount > 100) return 'bestseller' as const;
  if (!product.soldCount)       return 'new'        as const;
  return product.badge;
}

export async function TrendingProducts({ products, locale, viewAllLabel }: TrendingProductsProps) {
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <section className="py-16 md:py-20">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="flex items-start justify-between mb-8 md:mb-12">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-secondary mb-2">
              {t('trending.title')}
            </h2>
            <p className="text-muted">{t('trending.subtitle')}</p>
          </div>
          <Link
            href={`/${locale}/products`}
            className="hidden md:inline-flex items-center gap-1.5 text-primary font-semibold hover:underline text-sm shrink-0 mt-1"
          >
            {viewAllLabel}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile: horizontal snap scroll. Desktop: 4-col grid */}
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 md:pb-0 md:grid md:grid-cols-4 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {products.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="snap-start shrink-0 w-[200px] sm:w-[220px] md:w-auto">
                  <ProductCardSkeleton />
                </div>
              ))
            : products.map((product) => (
                <div key={product.id} className="snap-start shrink-0 w-[200px] sm:w-[220px] md:w-auto">
                  <ProductCard
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    imageUrl={product.images?.[0]?.url ?? 'https://placehold.co/400x500.png?text=No+Image'}
                    basePrice={product.basePrice}
                    compareAtPrice={product.compareAtPrice}
                    rating={product.rating?.avg}
                    reviewCount={product.rating?.count}
                    badge={deriveBadge(product)}
                    isPersonalizable={product.isPersonalizable}
                  />
                </div>
              ))}
        </div>

        {/* Mobile View All button — only shown when products exist */}
        {products.length > 0 && (
          <div className="mt-6 text-center md:hidden">
            <Link
              href={`/${locale}/products`}
              className="inline-flex items-center gap-2 text-primary font-semibold border border-primary px-6 py-3 rounded-button hover:bg-primary hover:text-white transition-colors text-sm"
            >
              {viewAllLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
