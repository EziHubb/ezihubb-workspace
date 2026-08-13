import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from './ProductCard';
import type { ProductListItemDto } from '@ezihubb/types';

interface RelatedProductsProps {
  products: ProductListItemDto[];
  locale:   string;
}

export function RelatedProducts({ products, locale }: RelatedProductsProps) {
  const t = useTranslations('product.pdp');
  if (products.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-secondary">
          {t('youMightAlsoLike')}
        </h2>
        <Link
          href={`/${locale}/search`}
          className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          {t('shopAll')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Mobile: horizontal snap scroll. Desktop: 4-col grid */}
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 md:pb-0 md:grid md:grid-cols-4 md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {products.map((product) => (
          <div
            key={product.id}
            className="snap-start shrink-0 w-[200px] sm:w-[220px] md:w-auto"
          >
            <ProductCard
              productId={product.id}
              slug={product.slug}
              locale={locale}
              image={product.images?.[0]?.url ?? 'https://placehold.co/400x500.png?text=No+Image'}
              name={product.name}
              price={product.basePrice}
              originalPrice={product.compareAtPrice}
              rating={product.averageRating ?? undefined}
              reviewCount={product.reviewCount}
              badge={product.badge}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
