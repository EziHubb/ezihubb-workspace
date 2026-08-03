import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ProductListItemDto, PaginatedResponse } from '@ezihubb/types';
import { queryKeys } from '../queryKeys';

export interface SearchQuery {
  q:         string;
  page?:     number;
  limit?:    number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?:     string;
}

/** Full-text product search with pagination. Disabled when query is empty. */
export function useSearch(query: SearchQuery) {
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn:  () =>
      api.get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.SEARCH.QUERY, {
        params: query as unknown as Record<string, string | number | boolean | undefined | null>,
      }),
    enabled:   Boolean(query.q?.trim()),
    staleTime: 30_000,
  });
}

/** Typeahead suggestions — fires after 2 characters. */
export function useSearchSuggestions(q: string) {
  return useQuery({
    queryKey: queryKeys.suggestions(q),
    queryFn:  () =>
      api.get<string[]>(API_ROUTES.SEARCH.SUGGESTIONS, { params: { q } }),
    enabled:   q.length >= 2,
    staleTime: 60_000,
  });
}
