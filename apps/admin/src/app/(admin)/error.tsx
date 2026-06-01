'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env['NODE_ENV'] !== 'production') {
      console.error('[Admin Error Boundary]', error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="bg-surface rounded-card border border-red-200 shadow-card p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-secondary mb-2">Something went wrong</h2>
        <p className="text-sm text-muted mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 mx-auto px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
        {error.digest && (
          <p className="text-[11px] text-muted mt-4 font-mono">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
