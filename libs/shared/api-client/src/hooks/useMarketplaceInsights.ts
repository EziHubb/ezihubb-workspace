import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import type {
  TrendingTermDto,
  TermDetailDto,
  TermAnalysisDto,
  SavedSearchTermDto,
} from '@ezihubb/types';
import { queryKeys } from '../queryKeys';

/** Top searched keywords across the marketplace, last 30 days — optionally scoped to one category. */
export function useTrendingTerms(limit = 20, category?: string) {
  return useQuery({
    queryKey: [...queryKeys.insightsTrending(), category ?? null],
    queryFn:  () =>
      api.get<TrendingTermDto[]>(API_ROUTES.MARKETPLACE_INSIGHTS.TRENDING, {
        params: { limit, category },
      }),
    staleTime: 5 * 60_000,
  });
}

/** Volume trend, conversion rate, and related terms for one keyword. */
export function useTermDetail(term: string) {
  return useQuery({
    queryKey: queryKeys.insightsTerm(term),
    queryFn:  () => api.get<TermDetailDto>(API_ROUTES.MARKETPLACE_INSIGHTS.TERM(term)),
    enabled:   Boolean(term.trim()),
    staleTime: 5 * 60_000,
  });
}

/** Price benchmarking, bestseller listings, and the caller's own price positioning. */
export function useTermAnalysis(term: string) {
  return useQuery({
    queryKey: queryKeys.insightsAnalysis(term),
    queryFn:  () => api.get<TermAnalysisDto>(API_ROUTES.MARKETPLACE_INSIGHTS.TERM_ANALYSIS(term)),
    enabled:   Boolean(term.trim()),
    staleTime: 5 * 60_000,
  });
}

/** The current seller's saved (watchlisted) search terms. */
export function useSavedSearches(enabled = true) {
  return useQuery({
    queryKey: queryKeys.savedSearches(),
    queryFn:  () => api.get<SavedSearchTermDto[]>(API_ROUTES.MARKETPLACE_INSIGHTS.SAVED_SEARCHES),
    enabled,
    staleTime: 60_000,
  });
}

/** Thumbs up/down on a "similar search term" suggestion. */
export function useSubmitRelatedTermFeedback() {
  return useMutation({
    mutationFn: ({ term, relatedTerm, helpful }: { term: string; relatedTerm: string; helpful: boolean }) =>
      api.post<void>(API_ROUTES.MARKETPLACE_INSIGHTS.TERM_RELATED_FEEDBACK(term), { relatedTerm, helpful }),
  });
}

export function useMutateSavedSearches() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.savedSearches() });

  const saveSearch = useMutation({
    mutationFn: (term: string) =>
      api.post<SavedSearchTermDto>(API_ROUTES.MARKETPLACE_INSIGHTS.SAVED_SEARCHES, { term }),
    onSuccess: invalidate,
  });

  const removeSavedSearch = useMutation({
    mutationFn: (id: string) =>
      api.delete<void>(API_ROUTES.MARKETPLACE_INSIGHTS.SAVED_SEARCH(id)),
    onSuccess: invalidate,
  });

  return { saveSearch, removeSavedSearch };
}
