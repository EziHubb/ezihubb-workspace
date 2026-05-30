import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { CategoryDto, CollectionDto, PaginatedResponse } from '@mlh/types';
import { queryKeys } from '../queryKeys';

// ── Query shapes ──────────────────────────────────────────────────────────────

export interface CategoriesQuery {
  parentId?: string | null;
  isActive?: boolean;
  limit?:    number;
}

export interface CollectionsQuery {
  isActive?:   boolean;
  isFeatured?: boolean;
  limit?:      number;
  page?:       number;
}

// ── Categories ────────────────────────────────────────────────────────────────

/** Root-level (or filtered) category list. */
export function useCategories(query: CategoriesQuery = {}) {
  return useQuery({
    queryKey: queryKeys.categories(query),
    queryFn:  () =>
      api.get<CategoryDto[]>(API_ROUTES.CATALOG.CATEGORIES, {
        params: query as Record<string, string | number | boolean | undefined | null>,
      }),
    staleTime: 5 * 60_000,
  });
}

/** Single category by slug, including its children. */
export function useCategory(slug: string) {
  return useQuery({
    queryKey: queryKeys.category(slug),
    queryFn:  () => api.get<CategoryDto>(API_ROUTES.CATALOG.CATEGORY(slug)),
    enabled:  Boolean(slug),
    staleTime: 5 * 60_000,
  });
}

// ── Collections ───────────────────────────────────────────────────────────────

/** Paginated list of collections (active, featured, etc.). */
export function useCollections(query: CollectionsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.collections(query),
    queryFn:  () =>
      api.get<PaginatedResponse<CollectionDto>>(API_ROUTES.CATALOG.COLLECTIONS, {
        params: query as Record<string, string | number | boolean | undefined | null>,
      }),
    staleTime: 5 * 60_000,
  });
}

/** Single collection by slug. */
export function useCollection(slug: string) {
  return useQuery({
    queryKey: queryKeys.collection(slug),
    queryFn:  () => api.get<CollectionDto>(API_ROUTES.CATALOG.COLLECTION(slug)),
    enabled:  Boolean(slug),
    staleTime: 5 * 60_000,
  });
}
