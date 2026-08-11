'use client';

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { ApiError } from '../../lib/api-client';
import { toast } from '../../lib/store/toast.store';
import { setStoreContext } from '../../lib/store-context';

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

function handle401(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 401) {
    setStoreContext(null);
    signOut({ callbackUrl: '/login' });
    return true;
  }
  return false;
}

/** Turns any thrown error into a user-facing message — never leaves an action silently failing. */
function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message || `Request failed (HTTP ${err.status})`;
  if (err instanceof Error) return err.message || 'Something went wrong. Please try again.';
  return 'Something went wrong. Please try again.';
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err, query) => {
        if (process.env['NODE_ENV'] !== 'production') {
          console.error('[Admin QueryCache]', err);
        }
        if (handle401(err)) return;
        // A background refetch failing behind data already on screen isn't worth
        // interrupting the admin with a toast — only surface it when the query has
        // nothing to show (first load, or a hard failure that cleared prior data).
        if (query.state.data !== undefined) return;
        toast.error(errorMessage(err), { description: 'Failed to load this page’s data.' });
      },
    }),
    mutationCache: new MutationCache({
      onError: (err) => {
        if (process.env['NODE_ENV'] !== 'production') {
          console.error('[Admin MutationCache]', err);
        }
        if (handle401(err)) return;
        toast.error(errorMessage(err));
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
