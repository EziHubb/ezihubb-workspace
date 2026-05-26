import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { OrderDto } from '@mlh/types';

export function useOrder(orderNumber: string) {
  return useQuery({
    queryKey: ['orders', orderNumber],
    queryFn:  () => api.get<OrderDto>(API_ROUTES.ORDERS.DETAIL(orderNumber)),
    enabled:  Boolean(orderNumber),
    staleTime: 60_000,
  });
}
