import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@mlh/constants';
import type { OrderDto, PaginatedResponse } from '@mlh/types';
import { queryKeys } from '../queryKeys';

// ── Query shapes ──────────────────────────────────────────────────────────────

export interface OrdersQuery {
  page?:   number;
  limit?:  number;
  status?: string;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Paginated order list for the authenticated user. */
export function useOrders(query: OrdersQuery = {}) {
  return useQuery({
    queryKey: queryKeys.orders(query),
    queryFn:  () =>
      api.get<PaginatedResponse<OrderDto>>(API_ROUTES.ORDERS.LIST, {
        params: query as Record<string, string | number | boolean | undefined | null>,
      }),
    staleTime: 30_000,
  });
}

/** Single order detail by order number. */
export function useOrder(orderNumber: string) {
  return useQuery({
    queryKey: queryKeys.order(orderNumber),
    queryFn:  () => api.get<OrderDto>(API_ROUTES.ORDERS.DETAIL(orderNumber)),
    enabled:  Boolean(orderNumber),
    staleTime: 30_000,
  });
}

/** Cancel an order (only possible within the 2-hour window after CONFIRMED). */
export function useCancelOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (orderNumber: string) =>
      api.post<OrderDto>(API_ROUTES.ORDERS.CANCEL(orderNumber)),
    onSuccess: (updatedOrder, orderNumber) => {
      // Update the specific order in cache immediately
      qc.setQueryData<OrderDto>(queryKeys.order(orderNumber), updatedOrder);
      // Invalidate the orders list so the status badge updates
      qc.invalidateQueries({ queryKey: queryKeys.orders() });
    },
  });
}
