'use client';

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';

function shouldRetry(failureCount: number, err: unknown): boolean {
  const status = (err as { statusCode?: number })?.statusCode;
  if (status === 401 || status === 403 || status === 404) return false;
  return failureCount < 1;
}

function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err) => {
        if (process.env['NODE_ENV'] !== 'production') {
          console.error('[Admin QueryCache]', err);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (err) => {
        if (process.env['NODE_ENV'] !== 'production') {
          console.error('[Admin MutationCache]', err);
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime:            30_000,
        gcTime:               5 * 60_000,
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
