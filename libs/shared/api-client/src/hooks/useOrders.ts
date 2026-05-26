import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { OrderDto, PaginatedResponse } from '@mlh/types';

export interface OrdersQuery {
  page?:   number;
  limit?:  number;
  status?: string;
}

export function useOrders(query: OrdersQuery = {}) {
  return useQuery({
    queryKey: ['orders', query],
    queryFn:  () =>
      api.get<PaginatedResponse<OrderDto>>(API_ROUTES.ORDERS.LIST, {
        params: query as Record<string, string | number | boolean | undefined | null>,
      }),
    staleTime: 30_000,
  });
}
