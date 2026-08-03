'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { SlidersHorizontal, X, Heart } from 'lucide-react';
import { Pagination } from '@ezihubb/ui';
import { useWishlist, useWishlistToggle } from '@ezihubb/api-client';
import { useAuthStore } from '../../lib/store/auth.store';
import type { ProductListItemDto, CategoryDto, TagDto } from '@ezihubb/types';
import { buildFilterUrl, SORT_OPTIONS } from '../listing/types';
import type { ListingFilters } from '../listing/types';
import { FilterSidebar } from '../listing/FilterSidebar';
import { FilterSheet }   from '../listing/FilterSheet';
import { SortDropdown }  from '../listing/SortDropdown';

// ── Keyword highlighting ──────────────────────────────────────────────────────

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const re    = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  const parts = text.split(re);

  return (
    <>
      {parts.map((part, i) =>
        re.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-100 text-inherit not-italic rounded-sm"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

// ── Search product card (custom — supports name highlighting) ─────────────────

function SearchProductCard({
  product,
  query,
  locale,
}: {
  product: ProductListItemDto;
  query:   string;
  locale:  string;
}) {
  const router         = useRouter();
  const pathname       = usePathname();
  const isLoggedIn     = Boolean(useAuthStore((s) => s.user));
  const isAuthReady    = useAuthStore((s) => s.isAuthReady);
  const { data: wishlistData } = useWishlist(isAuthReady && isLoggedIn);
  const wishlistToggle = useWishlistToggle();
  const isInWishlist   = wishlistData?.some((w) => w.productId === product.id) ?? false;

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      router.push(
        `/${locale}/login?redirect=${encodeURIComponent(pathname + window.location.search)}`,
      );
      return;
    }
    wishlistToggle(product.id, isInWishlist);
  };

  const discount =
    product.compareAtPrice && product.compareAtPrice > product.basePrice
      ? Math.round((1 - product.basePrice / product.compareAtPrice) * 100)
      : 0;

  return (
    <article className="group relative rounded-card border border-border bg-surface overflow-hidden hover:shadow-card-hover transition-shadow duration-200">
      {/* Image */}
      <Link
        href={`/${locale}/products/${product.slug}`}
        className="block relative aspect-[4/5] bg-background overflow-hidden"
      >
        <Image
          src={
            product.primaryImage ??
            'https://placehold.co/400x500/FFF5F0/E85D3F.png?text=No+Image'
          }
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Badge */}
        {product.badge && (
          <div className="absolute top-2 left-2">
            <span
              className={[
                'text-[11px] font-semibold rounded-pill px-2 py-0.5',
                product.badge === 'bestseller' ? 'bg-primary text-white'   : '',
                product.badge === 'new'        ? 'bg-purple-600 text-white' : '',
                product.badge === 'sale'       ? 'bg-error text-white'      : '',
                product.badge === 'hot'        ? 'bg-warning text-white'    : '',
              ].join(' ')}
            >
              {product.badge}
            </span>
          </div>
        )}

        {/* Wishlist */}
        <button
          type="button"
          onClick={handleWishlist}
          aria-label={isInWishlist ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className={`absolute top-2 right-2 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-colors ${isInWishlist ? 'text-error' : 'text-muted hover:text-error'}`}
        >
          <Heart className="w-4 h-4" fill={isInWishlist ? 'currentColor' : 'none'} />
        </button>
      </Link>

      {/* Info */}
      <div className="p-3 md:p-4">
        <Link href={`/${locale}/products/${product.slug}`}>
          <h3 className="text-sm font-medium text-secondary line-clamp-2 mb-1.5 leading-snug hover:text-primary transition-colors">
            <HighlightText text={product.name} query={query} />
          </h3>
        </Link>

        {product.rating !== undefined && (
          <div className="flex items-center gap-1 mb-1.5">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg
                  key={i}
                  className={`w-3 h-3 ${
                    i < Math.round(product.rating!.avg) ? 'text-warning' : 'text-border'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            {product.reviewCount !== undefined && product.reviewCount > 0 && (
              <span className="text-xs text-muted">({product.reviewCount})</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-secondary tabular-nums">
            ${product.basePrice.toFixed(2)}
          </span>
          {product.compareAtPrice && product.compareAtPrice > product.basePrice && (
            <>
              <span className="text-xs text-muted line-through tabular-nums">
                ${product.compareAtPrice.toFixed(2)}
              </span>
              {discount > 0 && (
                <span className="text-xs font-semibold text-error">
                  −{discount}%
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Props & main component ────────────────────────────────────────────────────

interface SearchResultsProps {
  query:          string;
  products:       ProductListItemDto[];
  totalCount:     number;
  totalPages:     number;
  isLoading:      boolean;
  currentFilters: ListingFilters;
  categories:     CategoryDto[];
  tags:           TagDto[];
  locale:         string;
}

export function SearchResults({
  query,
  products,
  totalCount,
  totalPages,
  isLoading,
  currentFilters,
  categories,
  tags,
  locale,
}: SearchResultsProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const pushFilters = (
    updates:   Partial<ListingFilters>,
    resetPage = true,
  ) => {
    const next = {
      ...currentFilters,
      ...updates,
      page: resetPage ? 1 : (updates.page ?? currentFilters.page),
    };
    router.push(buildFilterUrl(pathname, next));
  };

  const handlePageChange = (page: number) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    pushFilters({ page }, false);
  };

  // ── Active chips ───────────────────────────────────────────────────────────
  type Chip = { label: string; onRemove: () => void };
  const chips: Chip[] = [];

  if (currentFilters.category) {
    const cat = categories.find((c) => c.slug === currentFilters.category);
    chips.push({ label: cat?.name ?? currentFilters.category, onRemove: () => pushFilters({ category: undefined }) });
  }
  if (currentFilters.minPrice !== undefined)
    chips.push({ label: `From $${currentFilters.minPrice}`, onRemove: () => pushFilters({ minPrice: undefined }) });
  if (currentFilters.maxPrice !== undefined)
    chips.push({ label: `To $${currentFilters.maxPrice}`, onRemove: () => pushFilters({ maxPrice: undefined }) });
  if (currentFilters.rating !== undefined)
    chips.push({ label: `${'★'.repeat(currentFilters.rating)} & up`, onRemove: () => pushFilters({ rating: undefined }) });
  currentFilters.tags.forEach((slug) => {
    const tag = tags.find((t) => t.slug === slug);
    chips.push({
      label:    tag?.name ?? slug,
      onRemove: () => pushFilters({ tags: currentFilters.tags.filter((t) => t !== slug) }),
    });
  });

  // ── Skeleton grid ─────────────────────────────────────────────────────────
  const renderGrid = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[4/5] bg-border/30 rounded-card mb-3" />
              <div className="h-4 bg-border/30 rounded w-3/4 mb-2" />
              <div className="h-3 bg-border/30 rounded w-1/2" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {products.map((product) => (
          <SearchProductCard
            key={product.id}
            product={product}
            query={query}
            locale={locale}
          />
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Mobile sticky toolbar */}
      <div className="md:hidden sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-3 mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-secondary border border-border rounded-button px-4 py-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {chips.length > 0 && (
            <span className="bg-primary text-white text-[11px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {chips.length}
            </span>
          )}
        </button>
        <SortDropdown
          value={currentFilters.sort}
          onChange={(sort) => pushFilters({ sort })}
        />
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {chips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 text-sm border border-primary/30 bg-primary/5 text-primary rounded-pill px-3 py-1"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove ${chip.label}`}
                className="hover:text-error"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="text-sm text-muted hover:text-error underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Main two-col layout */}
      <div className="flex gap-8 items-start">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <FilterSidebar
            filters={currentFilters}
            categories={categories}
            tags={tags}
            onChange={(updates) => pushFilters(updates)}
            onClearAll={() => router.push(pathname)}
          />
        </div>

        {/* Grid + sort + pagination */}
        <div className="flex-1 min-w-0">
          {/* Desktop sort bar + count */}
          <div className="hidden md:flex items-center justify-between mb-6">
            <p className="text-sm text-muted">
              <span className="font-bold text-secondary">{totalCount}</span>{' '}
              result{totalCount !== 1 ? 's' : ''} for{' '}
              <span className="text-primary font-bold">&ldquo;{query}&rdquo;</span>
            </p>
            <SortDropdown
              value={currentFilters.sort}
              onChange={(sort) => pushFilters({ sort })}
            />
          </div>

          {/* Mobile count */}
          <p className="md:hidden text-sm text-muted mb-4">
            <span className="font-bold text-secondary">{totalCount}</span> result
            {totalCount !== 1 ? 's' : ''} for{' '}
            <span className="text-primary font-semibold">&ldquo;{query}&rdquo;</span>
          </p>

          {renderGrid()}

          {totalPages > 1 && (
            <div className="mt-10">
              <Pagination
                page={currentFilters.page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      <FilterSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={currentFilters}
        categories={categories}
        tags={tags}
        onApply={(newFilters) => {
          router.push(buildFilterUrl(pathname, newFilters));
        }}
      />
    </div>
  );
}
