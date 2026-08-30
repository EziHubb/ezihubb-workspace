'use client';

import { Suspense, useEffect, useState } from 'react';
import Script from 'next/script';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import { MetaPixel } from './MetaPixel';
import { PinterestTag } from './PinterestTag';
import {
  CONSENT_CHANGED_EVENT,
  type ConsentStatus,
  readConsent,
} from './consent';

const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
const gaId = process.env.NEXT_PUBLIC_GA_ID;
const hotjarId = Number(process.env.NEXT_PUBLIC_HOTJAR_ID ?? 0);

export function ConsentAwareAnalytics() {
  const [consent, setConsent] = useState<ConsentStatus | null>(null);

  useEffect(() => {
    setConsent(readConsent());
    const onConsentChanged = (event: Event) => {
      setConsent((event as CustomEvent<ConsentStatus>).detail);
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
  }, []);

  if (process.env.NODE_ENV !== 'production' || consent !== 'accepted') return null;

  return (
    <>
      {gtmId && <GoogleTagManager gtmId={gtmId} />}
      {!gtmId && gaId && <GoogleAnalytics gaId={gaId} />}
      <Suspense fallback={null}><MetaPixel /></Suspense>
      <Suspense fallback={null}><PinterestTag /></Suspense>
      {Number.isFinite(hotjarId) && hotjarId > 0 && (
        <Script
          id="hotjar"
          strategy="afterInteractive"
          // eslint-disable-next-line react/no-danger -- static vendor bootstrap, gated behind explicit consent
          dangerouslySetInnerHTML={{
            __html: `(function(h,o,t,j,a,r){
              h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:${hotjarId},hjsv:6};
              a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');r.async=1;
              r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
          }}
        />
      )}
    </>
  );
}
