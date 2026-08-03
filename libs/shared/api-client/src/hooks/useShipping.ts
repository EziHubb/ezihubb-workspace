import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ShippingOptionDto } from '@ezihubb/types';
import { queryKeys } from '../queryKeys';

/**
 * Fetch available shipping options for a country + order total.
 * Uses POST internally — React Query caches by queryKey regardless of HTTP method.
 */
export function useShippingOptions(countryCode: string, orderTotal: number) {
  return useQuery({
    queryKey: queryKeys.shippingMethods(countryCode),
    queryFn:  () =>
      api.post<ShippingOptionDto[]>(API_ROUTES.SHIPPING.CALCULATE, {
        countryCode,
        orderTotal,
      }),
    enabled:   Boolean(countryCode) && orderTotal > 0,
    staleTime: 5 * 60_000,
  });
}
