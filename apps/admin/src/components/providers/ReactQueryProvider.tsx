'use client';

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { ApiError } from '../../lib/api-client';

function shouldRetry(failureCount: number, err: unknown): boolean {
  if (err instanceof ApiError) {
    const { status } = err;
    if (status === 401 || status === 403 || status === 404) return false;
  }
  return failureCount < 1;
}

function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

function handle401(err: unknown) {
  if (err instanceof ApiError && err.status === 401) {
    signOut({ callbackUrl: '/login' });
  }
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err) => {
        handle401(err);
        if (process.env['NODE_ENV'] !== 'production') {
          console.error('[Admin QueryCache]', err);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (err) => {
        handle401(err);
        if (process.env['NODE_ENV'] !== 'production') {
          console.error('[Admin MutationCache]', err);
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime:            5 * 60_000,   // 5 min — navigating back won't refetch
        gcTime:               10 * 60_000,  // 10 min — keep unused data in memory
        retry:                shouldRetry,
        retryDelay,
        refetchOnWindowFocus: false,
        throwOnError:         false,
      },
      mutations: {
        retry:        0,
        throwOnError: false,
      },
    },
  });
}

const ReactQueryDevtools =
  process.env['NODE_ENV'] === 'development'
    ? dynamic(() =>
        import('@tanstack/react-query-devtools').then((m) => ({
          default: m.ReactQueryDevtools,
        }))
      )
    : () => null;

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
