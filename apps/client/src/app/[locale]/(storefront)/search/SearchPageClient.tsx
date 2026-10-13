'use client';

import { ListingExplorer } from '../../../../components/search/ListingExplorer';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * /search is the unrestricted case of the shared browse experience: nothing is
 * locked, and the query-driven sections under the grid apply.
 *
 * The implementation moved to ListingExplorer so /collections/[slug] renders
 * the identical UI instead of a second listing layout that drifts from it.
 */
export function SearchPageClient() {
  const t = useTranslations('search');
  const query = useSearchParams().get('q')?.trim();

  return (
    <>
      <h1 className="sr-only">
        {query ? t('headingForQuery', { query }) : t('heading')}
      </h1>
      <ListingExplorer />
    </>
  );
}
