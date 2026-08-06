'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';

const TAG_ID = process.env.NEXT_PUBLIC_PINTEREST_TAG_ID;

declare global {
  interface Window {
    pintrk?: {
      (...args: unknown[]): void;
      queue: unknown[];
      version: string;
    };
  }
}

export function PinterestTag() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!TAG_ID || typeof window.pintrk === 'undefined') return;
    window.pintrk('page');
  }, [pathname, searchParams]);

  if (!TAG_ID) return null;

  return (
    <>
      <Script
        id="pinterest-tag"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(e){if(!window.pintrk){window.pintrk = function () {
            window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
              n=window.pintrk;n.queue=[],n.version="3.0";var
              t=document.createElement("script");t.async=!0,t.src=e;var
              r=document.getElementsByTagName("script")[0];
              r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
            pintrk('load', '${TAG_ID}');
            pintrk('page');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          alt=""
          src={`https://ct.pinterest.com/v3/?event=init&tid=${TAG_ID}&noscript=1`}
        />
      </noscript>
    </>
  );
}
