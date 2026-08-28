'use client';

import { ListingExplorer } from '../../../../components/search/ListingExplorer';

/**
 * /search is the unrestricted case of the shared browse experience: nothing is
 * locked, and the query-driven sections under the grid apply.
 *
 * The implementation moved to ListingExplorer so /collections/[slug] renders
 * the identical UI instead of a second listing layout that drifts from it.
 */
export function SearchPageClient() {
  return <ListingExplorer />;
}
