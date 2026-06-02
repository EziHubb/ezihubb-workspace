import type { PaginatedResponse } from '@mlh/types';

// ── Filter state (lives in URL, not Zustand) ────────────────────────────────

export interface ListingFilters {
  sort:       string;
  minPrice?:  number;
  maxPrice?:  number;
  rating?:    number;
  tags:       string[];
  category?:  string;
  page:       number;
  /** Attribute filters: key=value pairs from ?attr[Material]=Bamboo */
  attributes?: Record<string, string>;
}

export const DEFAULT_FILTERS: ListingFilters = {
  sort: 'bestseller',
  tags: [],
  page: 1,
};

// ── Sort options ────────────────────────────────────────────────────────────

export const SORT_OPTIONS = [
  { value: 'bestseller', label: 'Best Selling'     },
  { value: 'newest',     label: 'Newest'           },
  { value: 'price_asc',  label: 'Price: Low–High'  },
  { value: 'price_desc', label: 'Price: High–Low'  },
  { value: 'rating',     label: 'Top Rated'        },
  { value: 'featured',   label: 'Featured'         },
] as const;

// ── URL ↔ filter serialisation ───────────────────────────────────────────────

/**
 * Build a clean URL search string from a filter object.
 * Omits default values to keep URLs short.
 */
export function buildFilterUrl(pathname: string, filters: ListingFilters): string {
  const params = new URLSearchParams();

  if (filters.sort !== 'bestseller')   params.set('sort',     filters.sort);
  if (filters.page > 1)                params.set('page',     String(filters.page));
  if (filters.category)                params.set('category', filters.category);
  if (filters.minPrice !== undefined)  params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice !== undefined)  params.set('maxPrice', String(filters.maxPrice));
  if (filters.rating   !== undefined)  params.set('rating',   String(filters.rating));
  filters.tags.forEach(tag => params.append('tags', tag));

  if (filters.attributes) {
    for (const [k, v] of Object.entries(filters.attributes)) {
      if (v) params.set(`attr[${k}]`, v);
    }
  }

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Parse Next.js route `searchParams` (plain object from server) into a typed
 * ListingFilters. Safe to call on the server.
 */
export function parseSearchParams(
  sp: Record<string, string | string[] | undefined>,
): ListingFilters {
  const get  = (key: string): string | undefined => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const getAll = (key: string): string[] => {
    const v = sp[key];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };

  // Parse attr[Key]=Value params (bracket notation)
  const attributes: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    const m = k.match(/^attr\[([^\]]+)\]$/);
    if (m && typeof v === 'string' && v) {
      attributes[m[1]] = v;
    }
  }

  return {
    sort:       get('sort')     ?? 'bestseller',
    minPrice:   get('minPrice') ? Number(get('minPrice')) : undefined,
    maxPrice:   get('maxPrice') ? Number(get('maxPrice')) : undefined,
    rating:     get('rating')   ? Number(get('rating'))   : undefined,
    tags:       getAll('tags'),
    category:   get('category'),
    page:       Number(get('page') ?? '1'),
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
  };
}

// ── Server-side data fetching helpers ────────────────────────────────────────

export interface PagedResult<T> {
  data:       T[];
  total:      number;
  totalPages: number;
}

const EMPTY_PAGE = <T>(): PagedResult<T> => ({ data: [], total: 0, totalPages: 0 });

export async function fetchPaged<T>(url: string, revalidate = 30): Promise<PagedResult<T>> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return EMPTY_PAGE<T>();
    const body = (await res.json()) as PaginatedResponse<T>;
    return {
      data:       body.data            ?? [],
      total:      body.pagination?.total      ?? 0,
      totalPages: body.pagination?.totalPages ?? 0,
    };
  } catch {
    return EMPTY_PAGE<T>();
  }
}

export async function fetchOne<T>(url: string, revalidate = 30): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: T };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchList<T>(url: string, revalidate = 60): Promise<T[]> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return [];
    const body = (await res.json()) as { data: T[]; success: boolean };
    return body.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Build the products API URL from a filter object plus any extra fixed params
 * (e.g., { categorySlug: 'mugs' } or { collectionSlug: 'summer' }).
 */
export function buildProductsApiUrl(
  base:    string,
  filters: ListingFilters,
  extra:   Record<string, string> = {},
): string {
  const url = new URL(`${base}/api/v1/products`);

  url.searchParams.set('sort',  filters.sort);
  url.searchParams.set('limit', '24');
  url.searchParams.set('page',  String(filters.page));

  for (const [k, v] of Object.entries(extra)) {
    if (v) url.searchParams.set(k, v);
  }

  if (filters.category)               url.searchParams.set('categorySlug', filters.category);
  if (filters.minPrice !== undefined)  url.searchParams.set('minPrice',     String(filters.minPrice));
  if (filters.maxPrice !== undefined)  url.searchParams.set('maxPrice',     String(filters.maxPrice));
  if (filters.rating   !== undefined)  url.searchParams.set('minRating',    String(filters.rating));
  filters.tags.forEach(tag => url.searchParams.append('tags', tag));

  return url.toString();
}
