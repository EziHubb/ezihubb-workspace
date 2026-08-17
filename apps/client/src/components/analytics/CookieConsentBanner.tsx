'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';

export function CookieConsentBanner() {
  const t = useTranslations('common');
  const locale = useLocale();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) setShow(true);
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    setShow(false);
    window.gtag?.('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage:        'granted',
    });
  };

  const reject = () => {
    localStorage.setItem('cookie_consent', 'rejected');
    setShow(false);
    window.gtag?.('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage:        'denied',
    });
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-lg px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <p className="text-sm text-secondary max-w-2xl">
        {t.rich('cookieConsent.message', {
          link: (chunks) => (
            <a href={`/${locale}/pages/privacy-policy`} className="text-primary hover:underline">
              {chunks}
            </a>
          ),
        })}
      </p>
      <div className="flex gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={reject}
          className="px-4 py-2 border border-border rounded-full text-sm text-muted hover:border-secondary transition-colors"
        >
          {t('cookieConsent.reject')}
        </button>
        <button
          type="button"
          onClick={accept}
          className="px-4 py-2 bg-primary text-white rounded-full text-sm hover:bg-primary-dark transition-colors"
        >
          {t('cookieConsent.acceptAll')}
        </button>
      </div>
    </div>
  );
}
