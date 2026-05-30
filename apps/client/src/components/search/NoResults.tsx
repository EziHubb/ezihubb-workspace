'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useProducts } from '@mlh/api-client';
import { ProductCard, ProductCardSkeleton } from '@mlh/ui';

const POPULAR_SEARCHES = [
  'custom mug',
  'photo canvas',
  'personalized gift',
  'anniversary',
  'birthday gift',
  'monogram tumbler',
];

interface NoResultsProps {
  query:    string;
  onSearch: (q: string) => void;
}

export function NoResults({ query, onSearch }: NoResultsProps) {
  const locale = useLocale();

  const { data, isLoading } = useProducts({ sort: 'bestseller', limit: 4 });
  const trending = data?.data ?? [];

  return (
    <div className="py-12 space-y-12">
      {/* Illustration + message */}
      <div className="flex flex-col items-center text-center gap-4">
        {/* SVG magnifying glass with sad face */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          aria-hidden="true"
          className="text-muted/30"
        >
          <circle cx="35" cy="35" r="22" stroke="currentColor" strokeWidth="4" />
          <line x1="51" y1="51" x2="70" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          {/* Sad face */}
          <circle cx="29" cy="32" r="2.5" fill="currentColor" />
          <circle cx="41" cy="32" r="2.5" fill="currentColor" />
          <path d="M29 41 Q35 37 41 41" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>

        <div>
          <h2 className="font-display text-xl md:text-2xl font-bold text-secondary mb-1">
            No results for{' '}
            <span className="text-primary">&ldquo;{query}&rdquo;</span>
          </h2>
          <p className="text-muted text-sm max-w-xs mx-auto">
            Check the spelling, or try a more general term.
          </p>
        </div>
      </div>

      {/* Popular suggestion chips */}
      <section>
        <p className="text-sm font-semibold text-secondary mb-3 text-center">
          Try searching for:
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => onSearch(term)}
              className="text-sm px-4 py-2 border border-border rounded-pill text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              {term}
            </button>
          ))}
        </div>
      </section>

      {/* Browse all button */}
      <div className="text-center">
        <Link
          href={`/${locale}/products`}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-8 py-3.5 rounded-button transition-colors uppercase tracking-wide"
        >
          Browse All Products
        </Link>
      </div>

      {/* Trending right now */}
      <section>
        <h3 className="font-display text-xl font-bold text-secondary mb-5">
          Trending Right Now
        </h3>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : trending.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  slug={product.slug}
                  name={product.name}
                  imageUrl={
                    product.primaryImage ??
                    'https://placehold.co/400x500?text=No+Image'
                  }
                  basePrice={product.basePrice}
                  compareAtPrice={product.compareAtPrice}
                  rating={product.rating}
                  reviewCount={product.reviewCount}
                  badge={product.badge}
                  isPersonalizable={product.isPersonalizable}
                />
              ))}
        </div>
      </section>
    </div>
  );
}
