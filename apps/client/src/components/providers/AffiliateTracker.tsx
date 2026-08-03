'use client';

import { useEffect } from 'react';
import { apiClient } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

export function AffiliateTracker() {
  useEffect(() => {
    const referralCode = getCookie('ezihubb_affiliate');
    const visitorId    = getCookie('ezihubb_visitor');
    if (!referralCode || !visitorId) return;

    apiClient
      .post(API_ROUTES.AFFILIATES.TRACK, {
        referralCode,
        visitorId,
        landingPage: window.location.href,
      })
      .catch(() => {}); // non-critical — tracking failure never blocks UX
  }, []);

  return null;
}
