'use client';

import { useEffect } from 'react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

// `document.referrer` is a page-load property — it does NOT change as the
// buyer navigates client-side between product/shop pages within the same
// tab. Without this guard, every internal navigation after landing from an
// external link would re-fire an OFFSITE_AD click (and re-log a fresh
// StoreLinkClick, resetting the 30-day attribution window), wrongly
// attributing every store the buyer merely browsed afterward. This
// module-level flag resets only on a real full page load, not on SPA route
// changes, so at most one referrer-based click is logged per browser tab load.
let referrerTrackedThisLoad = false;

interface MarketingTrackerProps {
  storeId:    string;
  productId?: string;
}

/**
 * Etsy Share & Save / Offsite Ads click attribution — forked from
 * AffiliateTracker's pattern (cookie read client-side, logged via an
 * explicit API call since the visitor cookie is scoped to this app's own
 * domain and isn't automatically forwarded to the API domain).
 *
 * Share & Save: the shop's tracking link carries a `?ss=<sharerId>` param —
 * the sharer's own user id, from the personalized link the "Share & Save"
 * widget generates. A missing/blank `ss` earns no reward; this is what
 * stops anyone self-serving a discount by hand-appending a bare param.
 * Offsite Ads: any visit arriving via an external (off-platform) referrer.
 * Mutually exclusive by design — only one fires per page view.
 */
export function MarketingTracker({ storeId, productId }: MarketingTrackerProps) {
  useEffect(() => {
    const visitorId = getCookie('ezihubb_visitor');
    if (!visitorId) return;

    const sharerId = new URLSearchParams(window.location.search).get('ss') || undefined;
    const referrerHost = (() => {
      if (referrerTrackedThisLoad || !document.referrer) return null;
      try {
        const host = new URL(document.referrer).hostname;
        return host === window.location.hostname ? null : host;
      } catch {
        return null;
      }
    })();

    const kind = sharerId ? 'SHARE_SAVE' : referrerHost ? 'OFFSITE_AD' : null;
    if (!kind) return;
    if (kind === 'OFFSITE_AD') referrerTrackedThisLoad = true;

    apiClient
      .post(API_ROUTES.MARKETING.TRACK_CLICK, { storeId, kind, visitorId, productId, sharerId })
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- non-critical tracking
      .catch(() => {});
  }, [storeId, productId]);

  return null;
}
