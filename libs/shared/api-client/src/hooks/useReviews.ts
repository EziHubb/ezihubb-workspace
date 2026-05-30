import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { ReviewDto, ReviewSummaryDto, PaginatedResponse } from '@mlh/types';
import { queryKeys } from '../queryKeys';

// ── Query shapes ──────────────────────────────────────────────────────────────

export interface ReviewsQuery {
  page?:   number;
  limit?:  number;
  /** Filter by exact star rating */
  rating?: number;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Paginated, filterable review list for a product.
 * Enabled once `productSlug` is a non-empty string.
 */
export function useReviews(productSlug: string, query: ReviewsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.reviews(productSlug, query),
    queryFn:  () =>
      api.get<PaginatedResponse<ReviewDto>>(
        API_ROUTES.PRODUCTS.REVIEWS(productSlug),
        { params: query as Record<string, string | number | boolean | undefined | null> },
      ),
    enabled:   Boolean(productSlug),
    staleTime: 60_000,
  });
}

/**
 * Aggregate rating summary (average, total, 1-5 distribution).
 * Cached for 5 min — changes infrequently.
 */
export function useReviewSummary(productSlug: string) {
  return useQuery({
    queryKey: queryKeys.reviewSummary(productSlug),
    queryFn:  () =>
      api.get<ReviewSummaryDto>(API_ROUTES.PRODUCTS.REVIEW_SUMMARY(productSlug)),
    enabled:   Boolean(productSlug),
    staleTime: 5 * 60_000,
  });
}
