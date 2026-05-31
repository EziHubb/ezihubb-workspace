'use client';

import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider } from '@mlh/ui';
import { AuthInitializer } from './AuthInitializer';

// ── Global error classifier ───────────────────────────────────────────────────

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && err.message === 'Failed to fetch';
}

function isAuthError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    ((err as { statusCode: number }).statusCode === 401 ||
      (err as { statusCode: number }).statusCode === 403)
  );
}

function shouldRetry(failureCount: number, err: unknown): boolean {
  // Never retry auth errors — they won't resolve without user action
  if (isAuthError(err)) return false;
  // Always retry transient network errors (up to 2x)
  if (isNetworkError(err)) return failureCount < 2;
  // Default: 1 retry for server errors
  return failureCount < 1;
}

function retryDelay(attempt: number): number {
  // Exponential back-off: 1s, 2s, 4s … capped at 10s
  return Math.min(1000 * 2 ** attempt, 10_000);
}

// ── Log query/mutation errors in development ──────────────────────────────────

function logError(label: string, err: unknown) {
  if (process.env['NODE_ENV'] !== 'production') {
    console.error(`[ReactQuery ${label}]`, err);
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err, query) => {
        logError(`query "${String(query.queryKey[0])}"`, err);
      },
    }),
    mutationCache: new MutationCache({
      onError: (err) => {
        logError('mutation', err);
      },
    }),
    defaultOptions: {
      queries: {
        /**
         * Data is fresh for 60 s → no refetch within that window.
         * After 60 s the query is stale and will refetch on next mount/focus.
         */
        staleTime:           60_000,
        /**
         * Keep unused query data in memory for 5 min before garbage collection.
         * Navigating back to a cached page feels instant.
         */
        gcTime:              5 * 60_000,
        retry:               shouldRetry,
        retryDelay,
        /**
         * Avoid jarring refetches when the user switches tabs.
         * Manual refetch via invalidateQueries() still works as expected.
         */
        refetchOnWindowFocus: false,
        /**
         * Don't throw errors to the nearest error boundary by default.
         * Individual hooks / pages can opt-in with throwOnError: true.
         */
        throwOnError:        false,
      },
      mutations: {
        retry:        0,
        throwOnError: false,
      },
    },
  });
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  // Create QueryClient once per component lifetime.
  // Using useState(factory) prevents re-creation on re-renders.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {/* ToastProvider is globally available — no need to wrap per-page */}
      <ToastProvider>
        {children}
      </ToastProvider>
      {/* Auth initializer — silently refreshes session token on app boot */}
      <AuthInitializer />
    </QueryClientProvider>
  );
}
