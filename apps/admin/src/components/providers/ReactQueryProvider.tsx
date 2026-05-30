'use client';

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
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

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env['NODE_ENV'] === 'development' && <AdminDevTools />}
    </QueryClientProvider>
  );
}

function AdminDevTools() {
  if (typeof window === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ReactQueryDevtools: DevTools } = require('@tanstack/react-query-devtools') as {
    ReactQueryDevtools: React.ComponentType<{ initialIsOpen?: boolean }>;
  };
  return <DevTools initialIsOpen={false} />;
}
