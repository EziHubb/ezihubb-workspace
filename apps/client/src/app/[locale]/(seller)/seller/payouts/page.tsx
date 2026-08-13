'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

/** Superseded by the Etsy-parity Finances module (Payment account /
 *  Monthly statements / Payment settings / Legal and tax information) —
 *  kept as a redirect so any bookmarked/old link still lands somewhere useful. */
export default function SellerPayoutsRedirectPage() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.replace(`/${locale}/seller/finances`);
  }, [router, locale]);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
