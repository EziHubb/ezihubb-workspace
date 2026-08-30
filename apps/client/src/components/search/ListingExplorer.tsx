'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState, useCallback, useTransition, useEffect, useRef, useMemo } from 'react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { CategoryDto } from '@ezihubb/types';
import { analytics } from '../../lib/analytics';

import { SearchTopBar } from './SearchTopBar';
import { SearchFilterSidebar } from './SearchFilterSidebar';
import { SearchProductGrid, SearchGridSkeleton, SearchPagination } from './SearchProductGrid';
import { SearchNoResults } from './SearchNoResults';
import { SearchError } from './SearchError';
import { RelatedSearches } from './RelatedSearches';
import { ShopCustomizableIdeas } from './ShopCustomizableIdeas';
import { RecentlyViewedPanel } from './RecentlyViewedPanel';
import { MobileFilterSheet } from './MobileFilterSheet';
import {
  buildApiParams,
  buildListingUrl,
  parseFilters,
  type ListingFilters,
  type SearchResponse,
} from './listing-params';

// ── Analytics (fire-and-forget) ───────────────────────────────────────────────

function logSearch(query: string, resultCount: number) {
  if (!query.trim()) return;
  analytics.search(query, resultCount);
  apiClient
    .post('/search/log', { query, resultCount })
    .catch(() => {/* non-critical */});
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ListingExplorerProps {
  /**
   * Filters forced onto every request and never shown as a removable chip —
   * `{ collection: 'wedding' }` on a collection page. They stay out of the URL,
   * so "clear all" cannot strip them and the shopper cannot filter their way
   * out of the page they are standing on.
   */
  lockedFilters?: Record<string, string>;
  /**
   * The query-driven sections under the grid. They are built around a search
   * term, so a page that has none turns them off.
   */
  showDiscovery?: boolean;
  /**
   * The first page, already fetched on the server. Used only while the URL
   * still carries the filters it was fetched for — see the guard below.
   */
  initialResults?: SearchResponse;
  /**
   * Whether the listing alone should fill the viewport. True on /search, where
   * it is the whole page; false where something already sits above and below
   * it, since a short result set would otherwise leave a screen of blank
   * between the grid and whatever comes next.
   */
  fillViewport?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * The whole browse experience — top bar, collapsible filter column, grid,
 * pagination, mobile sheet.
 *
 * Extracted from the search page so /collections/[slug] renders exactly the
 * same thing rather than a second, thinner listing UI that drifts from it.
 * Every piece of state lives in the URL, so the two pages differ only by which
 * filters are locked.
 */
export function ListingExplorer({
  lockedFilters,
  showDiscovery = true,
  initialResults,
  fillViewport = true,
}: ListingExplorerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Desktop filter column, CLOSED by default — the grid gets the full width
  // and the shopper opens filters when they want to narrow. The toggle carries
  // a count when filters are applied, so a collapsed panel never hides an
  // active filter silently.
  // Deliberately component state, not a URL param: the filters themselves
  // live in the URL so links stay shareable, but whether the panel is open is
  // a viewing preference and has no business in someone else's link.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // What the shopper chose, and what actually goes to the API. Kept apart on
  // purpose: the chips, the sidebar and every URL written below are built from
  // `filters`, so a locked filter can never reach the URL or turn up as a chip
  // with an X next to it.
  const filters = parseFilters(searchParams);
  const lockedKey = JSON.stringify(lockedFilters ?? {});
  const apiFilters = useMemo(
    () => ({ ...parseFilters(searchParams), ...(lockedFilters ?? {}) }),
    // lockedKey rather than lockedFilters: the object literal at the call site
    // is a new identity on every render of the parent, which would rebuild the
    // query key forever and refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, lockedKey],
  );
  const query = filters.q ?? '';
  const trimmedQ = query.trim();

  // ── Data fetch ───────────────────────────────────────────────────────────────

  // initialData seeds whichever key asks for it first, so without this guard it
  // would also seed the NEXT key after a filter change — showing the unfiltered
  // first page as if it were the filtered result until the refetch landed.
  const initialKey = useRef(JSON.stringify(apiFilters));
  const seed =
    initialResults && JSON.stringify(apiFilters) === initialKey.current
      ? initialResults
      : undefined;

  const { data, isLoading, isFetching, isFetched, isError, refetch } = useQuery({
    queryKey: ['search', 'results', apiFilters],
    queryFn: () =>
      apiClient.get<SearchResponse>(API_ROUTES.SEARCH.QUERY, {
        params: buildApiParams(apiFilters),
      }),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    initialData: seed,
  });

  // Category tree for the sidebar drill-down. One request for the whole
  // tree: the endpoint returns every level in a single Redis-cached
  // response, so fetching level by level would add round trips for data
  // that already arrived. Long staleTime — a taxonomy of 130 nodes does
  // not move during a browsing session.
  const { data: categories } = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn:  () => apiClient.get<CategoryDto[]>(API_ROUTES.CATALOG.CATEGORIES),
    staleTime: 30 * 60_000,
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
      const next: ListingFilters = { ...parseFilters(searchParams) };

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
        router.push(buildListingUrl(pathname, next), { scroll: false });
      });
    },
    [searchParams, pathname, router],
  );

  const clearFilter = useCallback(
    (key: string) => updateFilter(key, null),
    [updateFilter],
  );

  const clearAllFilters = useCallback(() => {
    const next: ListingFilters = {};
    const q = searchParams.get('q');
    if (q) next.q = q;
    startTransition(() => {
      router.push(buildListingUrl(pathname, next), { scroll: false });
    });
  }, [searchParams, pathname, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={fillViewport ? 'min-h-screen bg-background' : 'bg-background'}>
      {/* TOP BAR */}
      <SearchTopBar
        query={trimmedQ || undefined}
        totalCount={data?.pagination?.total ?? 0}
        sort={filters.sort ?? 'bestseller'}
        activeFilters={filters}
        onSortChange={(sort) => updateFilter('sort', sort)}
        onClearFilter={clearFilter}
        onClearAll={clearAllFilters}
        onOpenSidebar={() => setSidebarOpen(true)}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        filtersOpen={filtersOpen}
        isLoading={isFetching}
      />

      {/* Fluid up to a cap, not a fixed width — a hard max-w-1400 left 260px
          of dead margin on each side at 1920.
          The gutter is stepped, not fixed. Above the cap the centring margin
          supplies the breathing room on its own, but between roughly 1024 and
          1746 nothing is centring anything, so a flat 20px gutter put the grid
          hard against the window edge — which is exactly how it looked at the
          ~1536px width most of these screens actually run at. lg:px-12 gives
          that band a 48px gutter instead; below lg the sidebar is gone and the
          grid needs the width more than the margin, so it stays at px-6. */}
      <div className="flex w-full max-w-[1746px] mx-auto px-6 lg:px-12">
        {/* LEFT SIDEBAR (desktop) — collapsible, hidden on mobile.
            Mobile keeps its own bottom sheet and is unaffected by this
            toggle: on a small screen the filters are never taking space
            from the grid in the first place.

            No inner scroll: a fixed height plus overflow-y gave the column its
            own scrollbar, which cut whichever filter group happened to
            straddle the boundary in half. It scrolls with the page instead —
            `sticky top-16` holds it in view while the grid moves, and once it
            is taller than the viewport it scrolls away like everything else.
            Being longer than the results list is fine and expected. */}
        {/* Slides in and out like a drawer, rather than fading in place.
            Two transforms working together: the outer wrapper animates the
            width so the grid reflows into the freed space, and the inner
            column slides horizontally so the panel appears to travel off the
            left edge instead of being squeezed flat. Fading alone read as the
            panel blinking out; sliding shows where it went, which is what
            makes it obvious it can be brought back.
            The inner column keeps a fixed 220px throughout, so its content
            never reflows mid-animation. The wrapper stays mounted so the state
            inside it — which accordions are open, how far a Show-more list is
            expanded — survives a toggle instead of being thrown away. */}
        <div
          aria-hidden={!filtersOpen}
          inert={!filtersOpen}
          className={[
            'hidden lg:block flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-out',
            filtersOpen ? 'w-[236px]' : 'w-0',
          ].join(' ')}
        >
          <aside
            className={[
              'w-[220px] pt-4 pr-4 sticky top-[var(--header-offset)] self-start',
              'transition-transform duration-300 ease-out',
              filtersOpen ? 'translate-x-0' : '-translate-x-full',
            ].join(' ')}
          >
            <SearchFilterSidebar
              filters={filters}
              facets={data?.facets}
              categories={categories ?? []}
              onFilterChange={updateFilter}
              onClearAll={clearAllFilters}
            />
          </aside>
        </div>

        {/* PRODUCT GRID */}
        <div className="flex-1 min-w-0 pt-4 pb-16">
          {isLoading ? (
            <SearchGridSkeleton />
          ) : isError ? (
            /* Checked BEFORE the empty case: a failed request also yields
               zero results, and telling someone "nothing matched your search"
               when the server is down sends them off rewording a query that
               was never the problem. */
            <SearchError onRetry={() => refetch()} />
          ) : (data?.data?.length ?? 0) === 0 ? (
            <SearchNoResults query={trimmedQ || undefined} />
          ) : (
            <>
              <SearchProductGrid
                products={data?.data ?? []}
                isPending={isPending}
                searchTerm={trimmedQ || undefined}
              />
              <SearchPagination
                pagination={data?.pagination}
                onPageChange={(page) => updateFilter('page', String(page))}
              />
            </>
          )}
        </div>
      </div>

      {/* BOTTOM SECTIONS */}
      {showDiscovery && (data?.data?.length ?? 0) > 0 && (
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
          categories={categories ?? []}
          onFilterChange={updateFilter}
          onClearAll={clearAllFilters}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
