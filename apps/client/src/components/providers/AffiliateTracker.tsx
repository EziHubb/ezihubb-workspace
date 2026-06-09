'use client';

import { useEffect } from 'react';

function getCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

export function AffiliateTracker() {
  useEffect(() => {
    const referralCode = getCookie('mlh_affiliate');
    const visitorId    = getCookie('mlh_visitor');
    if (!referralCode || !visitorId) return;

    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? '';
    fetch(`${apiUrl}/api/v1/affiliates/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referralCode,
        visitorId,
        landingPage: window.location.href,
      }),
    }).catch(() => {}); // non-critical — tracking failure never blocks UX
  }, []);

  return null;
}
