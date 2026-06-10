'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';

interface SearchNoResultsProps {
  query?: string;
}

export function SearchNoResults({ query }: SearchNoResultsProps) {
  const locale = useLocale();

  const { data: trending = [] } = useQuery<string[]>({
    queryKey: ['search', 'trending'],
    queryFn: () => apiClient.get<string[]>(API_ROUTES.SEARCH.TRENDING),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="px-4 py-16 text-center max-w-lg mx-auto">
      <SearchX className="w-14 h-14 text-muted mx-auto mb-4" aria-hidden />

      <h2 className="text-xl font-bold text-secondary mb-2">
        {query ? <>No results for &ldquo;{query}&rdquo;</> : 'No products found'}
      </h2>

      <p className="text-muted text-sm mb-8">
        Try different keywords, check your spelling, or browse popular searches below.
      </p>

      {trending.length > 0 && (
        <div>
          <p className="text-sm font-medium text-secondary mb-3">Popular right now</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {trending.slice(0, 8).map((kw) => (
              <Link
                key={kw}
                href={`/${locale}/search?q=${encodeURIComponent(kw)}`}
                className="px-3 py-1.5 border border-border rounded-full text-sm text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                {kw}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link
        href={`/${locale}/products`}
        className="inline-flex items-center gap-2 mt-8 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-8 py-3.5 rounded-button transition-colors uppercase tracking-wide"
      >
        Browse All Products
      </Link>
    </div>
  );
}
