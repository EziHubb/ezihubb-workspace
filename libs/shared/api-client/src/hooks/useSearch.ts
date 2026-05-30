import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { ProductListItemDto, PaginatedResponse } from '@mlh/types';

export interface SearchQuery {
  q:       string;
  page?:   number;
  limit?:  number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

export function useSearch(query: SearchQuery) {
  return useQuery({
    queryKey: ['search', query],
    queryFn:  () =>
      api.get<PaginatedResponse<ProductListItemDto>>(API_ROUTES.SEARCH.QUERY, {
        params: query as unknown as Record<string, string | number | boolean | undefined | null>,
      }),
    enabled:  Boolean(query.q?.trim()),
    staleTime: 30_000,
  });
}

export function useSearchSuggestions(q: string) {
  return useQuery({
    queryKey: ['search-suggestions', q],
    queryFn:  () =>
      api.get<string[]>(API_ROUTES.SEARCH.SUGGESTIONS, { params: { q } }),
    enabled:  q.length >= 2,
    staleTime: 60_000,
  });
}
