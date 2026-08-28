import type { ProductListItemDto } from '@ezihubb/types';
import type { SearchFacets } from './SearchFilterSidebar';

/**
 * The URL <-> API translation shared by /search and /collections/[slug].
 *
 * Deliberately its own module with no 'use client': the collection page is a
 * server component and needs the exact same param building to pre-fetch the
 * first page. Importing these from ListingExplorer would hand it client
 * references instead of functions, which are not callable on the server.
 */

/** Flat filter map — every value is a string, as it is in the URL. */
export interface ListingFilters {
  [key: string]: string | undefined;
}

export interface SearchResponse {
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

/** First value wins for a repeated key, matching the old search behaviour. */
export function parseFilters(sp: URLSearchParams): ListingFilters {
  const filters: ListingFilters = {};
  sp.forEach((value, key) => {
    if (filters[key] === undefined) filters[key] = value;
  });
  return filters;
}

/**
 * Next hands a server page `Record<string, string | string[]>`; the client
 * reads URLSearchParams. Both have to end up at the same map or the
 * server-rendered first page would not match the key the client then looks
 * up, and the grid would flash empty on hydration.
 */
export function filtersFromRecord(
  sp: Record<string, string | string[] | undefined>,
): ListingFilters {
  const filters: ListingFilters = {};
  for (const [key, value] of Object.entries(sp)) {
    if (value === undefined) continue;
    filters[key] = Array.isArray(value) ? value[0] : value;
  }
  return filters;
}

export function buildApiParams(
  filters: ListingFilters,
): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(filters)) {
    // The sidebar stores a single colour selection as `color`; the API
    // param is `colors`.
    params[key === 'color' ? 'colors' : key] = value;
  }
  return params;
}

export function buildListingUrl(pathname: string, filters: ListingFilters): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
