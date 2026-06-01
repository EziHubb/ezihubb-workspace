'use client';

/**
 * Search page — CSR, noindex.
 * URL pattern: /${locale}/search?q=custom+mug&sort=bestseller&page=2
 */

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient, queryKeys } from '@mlh/api-client';
import type { PaginatedResponse, ProductListItemDto } from '@mlh/types';
import { SearchInput }   from '../../../../components/search/SearchInput';
import { SearchResults } from '../../../../components/search/SearchResults';
import { NoResults }     from '../../../../components/search/NoResults';
import { parseSearchParams } from '../../../../components/listing/types';

// ── Analytics: POST /search/log after results load ────────────────────────────

function logSearch(query: string, resultCount: number) {
  if (!query.trim()) return;
  apiClient
    .post('/search/log', { query, resultCount })
    .catch(() => {/* analytics is non-critical */});
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
  const page     = filters.page;

  const { data, isLoading, isFetched } = useQuery({
    queryKey: queryKeys.search({ q: trimmedQ, page }),
    queryFn:  () =>
      apiClient
        .get<PaginatedResponse<ProductListItemDto>>('/search', {
          params: {
            q:       trimmedQ,
            page,
            limit:   24,
            sort:    filters.sort,
            minPrice: filters.minPrice,
            maxPrice: filters.maxPrice,
          },
        })
        .then((r) => r),
    enabled:         trimmedQ.length > 0,
    staleTime:       60_000,
    placeholderData: (prev) => prev,  // keep old results while paginating
  });

  const products   = data?.data                  ?? [];
  const totalCount = data?.pagination?.total      ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 0;

  // Log search analytics after results load
  const loggedRef = useRef('');
  useEffect(() => {
    if (isFetched && trimmedQ && loggedRef.current !== trimmedQ) {
      loggedRef.current = trimmedQ;
      logSearch(trimmedQ, totalCount);
    }
  }, [isFetched, trimmedQ, totalCount]);

  const handleSearch = (q: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('q', q);
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

      {/* No query: show trending / empty state */}
      {!trimmedQ && (
        <div className="space-y-6">
          <h1 className="font-display text-2xl font-bold text-secondary text-center">
            What are you looking for?
          </h1>
          <NoResults query="" onSearch={handleSearch} />
        </div>
      )}

      {/* Has query */}
      {trimmedQ && (
        <>
          {/* Initial loading spinner (no data yet) */}
          {isLoading && !data && (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Results */}
          {(data || isLoading) && products.length > 0 && (
            <SearchResults
              query={trimmedQ}
              products={products}
              totalCount={totalCount}
              totalPages={totalPages}
              isLoading={isLoading}
              currentFilters={filters}
              categories={[]}
              tags={[]}
              locale={locale}
            />
          )}

          {/* No results — only after fetch completes with 0 results */}
          {isFetched && !isLoading && products.length === 0 && (
            <NoResults query={trimmedQ} onSearch={handleSearch} />
          )}
        </>
      )}
    </div>
  );
}
