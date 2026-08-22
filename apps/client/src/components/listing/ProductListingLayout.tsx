'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { Pagination } from '@ezihubb/ui';
import { usePaginationLabels } from '../../lib/hooks/usePaginationLabels';
import type { CategoryDto, TagDto, ProductListItemDto } from '@ezihubb/types';
import { buildFilterUrl, SORT_OPTIONS } from './types';
import type { ListingFilters } from './types';
import { FilterSidebar } from './FilterSidebar';
import { FilterSheet } from './FilterSheet';
import { SortDropdown } from './SortDropdown';
import { ProductGrid } from './ProductGrid';

export interface ProductListingLayoutProps {
  locale:         string;
  title:          string;
  subtitle?:      string;
  products:       ProductListItemDto[];
  totalCount:     number;
  totalPages:     number;
  /** Parsed from server searchParams — used as the source of truth for current filters. */
  currentFilters: ListingFilters;
  categories:     CategoryDto[];
  tags:           TagDto[];
}

export function ProductListingLayout({
  locale,
  title,
  subtitle,
  products,
  totalCount,
  totalPages,
  currentFilters,
  categories,
  tags,
}: ProductListingLayoutProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const paginationLabels = usePaginationLabels();
  const [sheetOpen, setSheetOpen] = useState(false);

  // ── Filter mutation helpers ───────────────────────────────────────────────

  /** Push updated filters to URL (resets page to 1 unless page is explicitly set). */
  const pushFilters = (
    updates:   Partial<ListingFilters>,
    resetPage = true,
  ) => {
    const next: ListingFilters = {
      ...currentFilters,
      ...updates,
      page: resetPage
        ? 1
        : (updates.page ?? currentFilters.page),
    };
    router.push(buildFilterUrl(pathname, next));
  };

  const handlePageChange = (page: number) => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    pushFilters({ page }, false);
  };

  const clearAll = () => router.push(pathname);

  // ── Active filter chips ───────────────────────────────────────────────────

  type Chip = { label: string; onRemove: () => void };
  const chips: Chip[] = [];

  if (currentFilters.category) {
    const cat = categories.find((c) => c.slug === currentFilters.category);
    chips.push({
      label:    cat?.name ?? currentFilters.category,
      onRemove: () => pushFilters({ category: undefined }),
    });
  }
  if (currentFilters.minPrice !== undefined) {
    chips.push({
      label:    `From $${currentFilters.minPrice}`,
      onRemove: () => pushFilters({ minPrice: undefined }),
    });
  }
  if (currentFilters.maxPrice !== undefined) {
    chips.push({
      label:    `To $${currentFilters.maxPrice}`,
      onRemove: () => pushFilters({ maxPrice: undefined }),
    });
  }
  if (currentFilters.rating !== undefined) {
    chips.push({
      label:    `${'★'.repeat(currentFilters.rating)} & up`,
      onRemove: () => pushFilters({ rating: undefined }),
    });
  }
  currentFilters.tags.forEach((slug) => {
    const tag = tags.find((t) => t.slug === slug);
    chips.push({
      label:    tag?.name ?? slug,
      onRemove: () =>
        pushFilters({ tags: currentFilters.tags.filter((t) => t !== slug) }),
    });
  });

  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === currentFilters.sort)?.label ?? 'Sort';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Page header */}
      <header className="mb-6 md:mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold text-secondary leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted mt-2 text-base md:text-lg">{subtitle}</p>
        )}
      </header>

      {/* ── Mobile: sticky toolbar ─────────────────────────────────────────── */}
      <div className="md:hidden sticky top-[var(--header-offset)] z-30 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 px-4 py-3 mb-4 flex items-center justify-between gap-3">
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

      {/* ── Active filter chips ───────────────────────────────────────────── */}
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
                aria-label={`Remove ${chip.label} filter`}
                className="hover:text-error transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-muted hover:text-error underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Main two-col layout ───────────────────────────────────────────── */}
      <div className="flex gap-8 items-start">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <FilterSidebar
            filters={currentFilters}
            categories={categories}
            tags={tags}
            onChange={(updates) => pushFilters(updates)}
            onClearAll={clearAll}
          />
        </div>

        {/* Product area */}
        <div className="flex-1 min-w-0">
          {/* Desktop: result count + sort */}
          <div className="hidden md:flex items-center justify-between mb-6">
            <p className="text-sm text-muted">
              <span className="font-semibold text-secondary">{totalCount}</span>{' '}
              {totalCount === 1 ? 'product' : 'products'}
            </p>
            <SortDropdown
              value={currentFilters.sort}
              onChange={(sort) => pushFilters({ sort })}
            />
          </div>

          {/* Mobile: result count */}
          <p className="md:hidden text-sm text-muted mb-4">
            <span className="font-semibold text-secondary">{totalCount}</span>{' '}
            {totalCount === 1 ? 'product' : 'products'}
          </p>

          <ProductGrid products={products} locale={locale} />

          {totalPages > 1 && (
            <div className="mt-10">
              <Pagination
                page={currentFilters.page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                labels={paginationLabels}
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
