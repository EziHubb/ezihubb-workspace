'use client';

/**
 * Search page — CSR, noindex.
 * URL pattern: /${locale}/search?q=custom+mug&sort=bestseller&page=2
 */

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useSearch, useCategories } from '@mlh/api-client';
import { SearchInput }   from '../../../../components/search/SearchInput';
import { SearchResults } from '../../../../components/search/SearchResults';
import { NoResults }     from '../../../../components/search/NoResults';
import { parseSearchParams } from '../../../../components/listing/types';
import type { ListingFilters } from '../../../../components/listing/types';

// ── Analytics: POST /search/log after results load ────────────────────────────

const API_BASE = () =>
  (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_API_URL']) ||
  'http://localhost:3002';

function logSearch(query: string, resultCount: number) {
  if (!query.trim()) return;
  fetch(`${API_BASE()}/api/v1/search/log`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    credentials: 'include',
    body:        JSON.stringify({ query, resultCount }),
  }).catch(() => {/* analytics is non-critical */});
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const locale       = useLocale();
  const searchParams = useSearchParams();
  const router       = useRouter();

  // Read q + filter params from URL
  const rawParams: Record<string, string | string[]> = {};
  searchParams.forEach((v, k) => {
    const existing = rawParams[k];
    rawParams[k] = existing
      ? Array.isArray(existing) ? [...existing, v] : [existing, v]
      : v;
  });

  const filters  = parseSearchParams(rawParams);
  const query    = searchParams.get('q') ?? '';
  const trimmedQ = query.trim();

  // Use search hook — disabled when query is empty
  const {
    data:      searchData,
    isLoading: isSearching,
    isFetched,
  } = useSearch({
    q:        trimmedQ,
    page:     filters.page,
    limit:    24,
    sort:     filters.sort,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  } as Parameters<typeof useSearch>[0]);

  const { data: categoriesData } = useCategories({ parentId: null });
  const categories = categoriesData ?? [];

  const products   = searchData?.data ?? [];
  const totalCount = searchData?.pagination?.total      ?? 0;
  const totalPages = searchData?.pagination?.totalPages ?? 0;

  // ── Log search analytics after results load ────────────────────────────────
  const loggedRef = useRef('');
  useEffect(() => {
    if (isFetched && trimmedQ && loggedRef.current !== trimmedQ) {
      loggedRef.current = trimmedQ;
      logSearch(trimmedQ, totalCount);
    }
  }, [isFetched, trimmedQ, totalCount]);

  // ── Handle SearchInput submit ──────────────────────────────────────────────
  const handleSearch = (q: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('q', q);
    // Reset page on new search
    url.searchParams.delete('page');
    router.push(url.pathname + url.search);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8 md:py-12">

      {/* Large search bar at top of page */}
      <div className="mb-8 max-w-2xl mx-auto">
        <SearchInput
          defaultValue={query}
          variant="page"
          placeholder="Search for gifts, mugs, canvas prints…"
          onSearch={handleSearch}
          autoFocus={!query}
          className="w-full"
        />
      </div>

      {/* ── No query: show trending ── */}
      {!trimmedQ && (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-bold text-secondary text-center">
            What are you looking for?
          </h1>
          <NoResults query="" onSearch={handleSearch} />
        </div>
      )}

      {/* ── Has query: show results or no-results ── */}
      {trimmedQ && (
        <>
          {/* Loading: show spinner only on initial load (no data yet) */}
          {isSearching && !searchData && (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Results */}
          {(searchData || isSearching) && products.length > 0 && (
            <SearchResults
              query={trimmedQ}
              products={products}
              totalCount={totalCount}
              totalPages={totalPages}
              isLoading={isSearching}
              currentFilters={filters}
              categories={categories}
              tags={[]}
              locale={locale}
            />
          )}

          {/* No results (only after fetch completes with 0 results) */}
          {isFetched && !isSearching && products.length === 0 && (
            <NoResults query={trimmedQ} onSearch={handleSearch} />
          )}
        </>
      )}
    </div>
  );
}
