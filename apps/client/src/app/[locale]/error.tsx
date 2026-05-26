'use client';

import { useEffect } from 'react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error);

    // Report to Sentry when configured — dynamic import avoids hard dependency
    if (typeof window !== 'undefined' && process.env['NEXT_PUBLIC_SENTRY_DSN']) {
      import(/* webpackIgnore: true */ '@sentry/nextjs' as string)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((mod: any) => mod.captureException?.(error))
        .catch(() => undefined);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-secondary">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again, or contact support if the problem persists.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-6 py-2.5 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
