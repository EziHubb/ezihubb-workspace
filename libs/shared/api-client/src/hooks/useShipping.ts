import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ShippingEstimateDto } from '@ezihubb/types';
import { queryKeys } from '../queryKeys';

/**
 * Resolve the automatic per-seller delivery cost/timeline for the current
 * cart at a given destination country, from each seller's own Delivery
 * profile (Etsy-parity — there is no buyer-facing method picker).
 */
export function useShippingEstimate(countryCode: string) {
  return useQuery({
    queryKey: queryKeys.shippingEstimate(countryCode),
    queryFn:  () =>
      api.post<ShippingEstimateDto>(API_ROUTES.CART.ESTIMATE_SHIPPING, {
        country: countryCode,
      }),
    enabled:   Boolean(countryCode),
    staleTime: 5 * 60_000,
  });
}
