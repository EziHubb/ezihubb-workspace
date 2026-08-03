'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useTransition, useEffect, useRef } from 'react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductListItemDto } from '@ezihubb/types';
import { analytics } from '../../../../lib/analytics';

import { SearchTopBar } from '../../../../components/search/SearchTopBar';
import { SearchFilterSidebar } from '../../../../components/search/SearchFilterSidebar';
import {
  SearchProductGrid,
  SearchGridSkeleton,
  SearchPagination,
} from '../../../../components/search/SearchProductGrid';
import { SearchNoResults } from '../../../../components/search/SearchNoResults';
import { RelatedSearches } from '../../../../components/search/RelatedSearches';
import { ShopCustomizableIdeas } from '../../../../components/search/ShopCustomizableIdeas';
import { RecentlyViewedPanel } from '../../../../components/search/RecentlyViewedPanel';
import { MobileFilterSheet } from '../../../../components/search/MobileFilterSheet';

// ── Types ─────────────────────────────────────────────────────────────────────

import type { SearchFacets } from '../../../../components/search/SearchFilterSidebar';

interface SearchResponse {
  data: ProductListItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  facets: SearchFacets;
  appliedFilters: Record<string, unknown>;
  correctedQuery: string | null;
}

// Flat filter map — all values are strings in the URL. Bracket-notation attr
// keys (attr[Material]) are stored literally as keys in this map.
// The optional `attrs` map is a convenience for the sidebar but not part of
// the URL serialisation — it's typed separately to avoid polluting string keys.
interface ParsedFilters {
  [key: string]: string | undefined;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFilters(sp: URLSearchParams): ParsedFilters {
  const filters: ParsedFilters = {};
  sp.forEach((value, key) => {
    // Don't overwrite; take the first value for repeated keys
    if (filters[key] === undefined) {
      filters[key] = value;
    }
  });
  return filters;
}

function buildApiParams(filters: ParsedFilters): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(filters)) {
    // The sidebar stores single color selection as `color`; the API param is `colors`
    params[key === 'color' ? 'colors' : key] = value;
  }
  return params;
}

function buildSearchUrl(pathname: string, filters: ParsedFilters): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      sp.set(key, value);
    }
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

// ── Analytics (fire-and-forget) ───────────────────────────────────────────────

function logSearch(query: string, resultCount: number) {
  if (!query.trim()) return;
  analytics.search(query, resultCount);
  apiClient
    .post('/search/log', { query, resultCount })
    .catch(() => {/* non-critical */});
}

// ── Client component ──────────────────────────────────────────────────────────

export function SearchPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filters = parseFilters(searchParams);
  const query = filters.q ?? '';
  const trimmedQ = query.trim();

  // ── Data fetch ───────────────────────────────────────────────────────────────

  const { data, isLoading, isFetching, isFetched } = useQuery({
    queryKey: ['search', 'results', filters],
    queryFn: () =>
      apiClient.get<SearchResponse>(API_ROUTES.SEARCH.QUERY, {
        params: buildApiParams(filters),
      }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  // ── Analytics logging ─────────────────────────────────────────────────────

  const loggedRef = useRef('');
  useEffect(() => {
    const total = data?.pagination?.total ?? 0;
    if (isFetched && trimmedQ && loggedRef.current !== trimmedQ) {
      loggedRef.current = trimmedQ;
      logSearch(trimmedQ, total);
    }
  }, [isFetched, trimmedQ, data?.pagination?.total]);

  // ── Filter mutations ──────────────────────────────────────────────────────

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const next: ParsedFilters = { ...filters };

      if (value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }

      // Reset to page 1 on any filter change except explicit page changes
      if (key !== 'page') {
        delete next['page'];
      }

      startTransition(() => {
        router.push(buildSearchUrl(pathname, next), { scroll: false });
      });
    },
    [filters, pathname, router],
  );

  const clearFilter = useCallback(
    (key: string) => updateFilter(key, null),
    [updateFilter],
  );

  const clearAllFilters = useCallback(() => {
    const next: ParsedFilters = {};
    if (filters.q) next.q = filters.q;
    startTransition(() => {
      router.push(buildSearchUrl(pathname, next), { scroll: false });
    });
  }, [filters.q, pathname, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      {/* SEARCH TOP BAR */}
      <SearchTopBar
        query={trimmedQ || undefined}
        totalCount={data?.pagination?.total ?? 0}
        sort={filters.sort ?? 'bestseller'}
        activeFilters={filters}
        onSortChange={(sort) => updateFilter('sort', sort)}
        onClearFilter={clearFilter}
        onClearAll={clearAllFilters}
        onOpenSidebar={() => setSidebarOpen(true)}
        isLoading={isFetching}
      />

      <div className="flex max-w-[1400px] mx-auto">
        {/* LEFT SIDEBAR (desktop) — hidden on mobile */}
        <aside className="hidden lg:block w-[220px] flex-shrink-0 pt-4 pr-4 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <SearchFilterSidebar
            filters={filters}
            facets={data?.facets}
            onFilterChange={updateFilter}
            onClearAll={clearAllFilters}
          />
        </aside>

        {/* PRODUCT GRID */}
        <main className="flex-1 min-w-0 px-4 pt-4 pb-16">
          {isLoading ? (
            <SearchGridSkeleton />
          ) : (data?.data?.length ?? 0) === 0 ? (
            <SearchNoResults query={trimmedQ || undefined} />
          ) : (
            <>
              <SearchProductGrid
                products={data?.data ?? []}
                isPending={isPending}
              />
              <SearchPagination
                pagination={data?.pagination}
                onPageChange={(page) => updateFilter('page', String(page))}
              />
            </>
          )}
        </main>
      </div>

      {/* BOTTOM SECTIONS */}
      {(data?.data?.length ?? 0) > 0 && (
        <>
          <RelatedSearches query={trimmedQ || undefined} />
          <ShopCustomizableIdeas query={trimmedQ || undefined} />
        </>
      )}

      {/* RECENTLY VIEWED (sticky bottom-left) */}
      <RecentlyViewedPanel />

      {/* MOBILE FILTER SHEET */}
      {sidebarOpen && (
        <MobileFilterSheet
          filters={filters}
          facets={data?.facets}
          onFilterChange={updateFilter}
          onClearAll={clearAllFilters}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
