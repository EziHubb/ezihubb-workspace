'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';

interface RelatedSearchesProps {
  query?: string;
}

export function RelatedSearches({ query }: RelatedSearchesProps) {
  const locale = useLocale();

  const { data: related = [] } = useQuery<string[]>({
    queryKey: ['search', 'related', query],
    queryFn: () =>
      apiClient.get<string[]>(API_ROUTES.SEARCH.RELATED, { params: { q: query ?? '' } }),
    enabled: !!query,
    staleTime: 5 * 60_000,
  });

  if (!query || related.length === 0) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-4 py-8 border-t border-border">
      <h2 className="font-semibold text-secondary mb-4">Related searches</h2>
      <div className="flex flex-wrap gap-2">
        {related.map((kw) => (
          <Link
            key={kw}
            href={`/${locale}/search?q=${encodeURIComponent(kw)}`}
            className="px-3 py-1.5 border border-border rounded-full text-sm text-secondary hover:border-primary hover:text-primary transition-colors"
          >
            {kw}
          </Link>
        ))}
      </div>
    </section>
  );
}
