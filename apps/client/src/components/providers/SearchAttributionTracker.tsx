'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { saveSearchAttribution } from '../../lib/search-attribution';

/**
 * Place on the product detail page. Reads ?st=<term> (set by SearchProductCard
 * links) and, when present: fires a click-tracking beacon for marketplace
 * insights, and remembers the term client-side so a later add-to-cart can
 * carry it through to checkout (see cart.store.ts addItem + search-attribution.ts).
 */
export function SearchAttributionTracker() {
  const searchParams = useSearchParams();
  const term = searchParams.get('st');

  useEffect(() => {
    if (!term) return;
    saveSearchAttribution(term);
    apiClient.post(API_ROUTES.SEARCH.CLICK, { term }).catch(() => {});
  }, [term]);

  return null;
}
