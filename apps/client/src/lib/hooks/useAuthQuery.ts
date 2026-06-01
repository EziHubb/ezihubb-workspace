import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@mlh/api-client';
import type { ApiResponse } from '@mlh/types';
import { useAuthStore } from '../store/auth.store';

/**
 * Authenticated GET — wraps useQuery with the current auth token.
 * Query is disabled when no token is present (user not logged in).
 *
 * Usage:
 *   const { data, isLoading } = useAuthQuery<UserDto[]>(
 *     ['my-key'],
 *     '/users/me/something',
 *     { param: value },
 *   )
 *
 * The queryFn calls apiClient.get<ApiResponse<T>>() and returns r.data,
 * so `data` is typed as T (not the full envelope).
 */
export function useAuthQuery<T>(
  queryKey: readonly unknown[],
  path: string,
  params?: Record<string, unknown>,
  options?: { enabled?: boolean; staleTime?: number },
) {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery<T>({
    queryKey,
    // apiClient auto-unwraps the envelope — returns T (the data field) directly
    queryFn: () =>
      apiClient.get<T>(path, {
        token:  token ?? undefined,
        params: params as Record<string, string | number | boolean | undefined>,
      }),
    enabled:   !!token && (options?.enabled !== false),
    staleTime: options?.staleTime ?? 30_000,
  });
}

/**
 * Authenticated mutation — injects the current auth token into the mutation fn.
 * Automatically invalidates the provided query keys on success.
 *
 * Usage:
 *   const mutation = useAuthMutation(
 *     (vars: InputDto, token) =>
 *       apiClient.post<ApiResponse<ResultDto>>('/some/path', vars, { token }),
 *     { invalidateKeys: [['my-key']], onSuccess: (data) => console.log(data) }
 *   )
 *   mutation.mutate(vars)
 *
 * TData is the type returned by mutationFn (usually ApiResponse<Something>).
 */
export function useAuthMutation<TData, TVariables>(
  mutationFn: (vars: TVariables, token: string) => Promise<TData>,
  options?: {
    onSuccess?:      (data: TData) => void;
    invalidateKeys?: (readonly unknown[])[];
  },
) {
  const token       = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: (vars) => mutationFn(vars, token ?? ''),
    onSuccess:  (data) => {
      options?.invalidateKeys?.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
      options?.onSuccess?.(data);
    },
  });
}
