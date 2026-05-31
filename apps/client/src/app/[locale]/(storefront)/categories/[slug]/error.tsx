'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function CategoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CategoryPage error]', error);
  }, [error]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-8 h-8 text-error" />
      </div>
      <h1 className="font-display text-2xl font-bold text-secondary mb-3">
        Something went wrong
      </h1>
      <p className="text-muted mb-8 max-w-sm mx-auto">
        We couldn't load this category. Please try again.
      </p>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-2.5 rounded-button transition-colors text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
        <Link
          href="/products"
          className="text-sm text-primary hover:underline underline-offset-2"
        >
          Browse all products
        </Link>
      </div>
    </div>
  );
}
