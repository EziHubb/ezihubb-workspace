import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import { ReactQueryProvider } from '../../components/providers/ReactQueryProvider';
import { NextAuthProvider } from '../../components/providers/NextAuthProvider';
import { ToastContainer } from '../../components/ui/ToastContainer';
import { WebVitals } from '../../components/providers/WebVitals';
import { CookieConsentBanner } from '../../components/analytics/CookieConsentBanner';
import { MetaPixel } from '../../components/analytics/MetaPixel';
import { PinterestTag } from '../../components/analytics/PinterestTag';
import { OrganizationStructuredData } from '../../components/seo/OrganizationStructuredData';
import { WebsiteStructuredData } from '../../components/seo/WebsiteStructuredData';
import { AffiliateTracker } from '../../components/providers/AffiliateTracker';
import { CurrencyProvider } from '../../lib/currency/currency-context';
import '../global.css';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-playfair',
  display: 'swap',
});

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'site' });
  const isVi = locale === 'vi';
  return {
    metadataBase: new URL('https://ezihubb.com'),
    title: {
      template: `%s | ${t('name')}`,
      default:  t('defaultTitle'),
    },
    description: t('defaultDescription'),
    keywords: [
      'personalized gifts', 'custom gifts', 'photo gifts',
      'handmade gifts', 'custom mugs', 'canvas prints', 'ezihubb',
    ],
    authors:   [{ name: 'EziHubb' }],
    creator:   'EziHubb',
    publisher: 'EziHubb',
    openGraph: {
      siteName: t('name'),
      locale:   isVi ? 'vi_VN' : 'en_US',
      type:     'website',
      images:   [{ url: '/og-default.jpg', width: 1200, height: 630,
                   alt: 'EziHubb — Personalized Gifts' }],
    },
    twitter: {
      card:    'summary_large_image',
      site:    '@ezihubb',
      creator: '@ezihubb',
    },
    robots: {
      index:  true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    icons: {
      icon: '/favicon.ico',
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    },
    alternates: {
      canonical: isVi ? 'https://ezihubb.com/vi' : 'https://ezihubb.com',
      languages: {
        'en':        'https://ezihubb.com',
        'vi':        'https://ezihubb.com/vi',
        'x-default': 'https://ezihubb.com',
      },
    },
  };
}

async function fetchSiteThemeStyle(): Promise<string> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';
    const res = await fetch(`${apiBase}/api/v1/settings/theme`, {
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const json = (await res.json()) as {
      success: boolean;
      data: { primaryRgb?: string; primaryDark?: string; primaryLight?: string };
    };
    const { primaryRgb = '232 93 63', primaryDark = '#C44A2E', primaryLight = '#FFF0EC' } = json.data ?? {};
    return `:root{--c-primary:${primaryRgb};--c-primary-dark:${primaryDark};--c-primary-light:${primaryLight};}`;
  } catch {
    return '';
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as 'en' | 'vi')) {
    notFound();
  }

  // Required by next-intl v4 for static rendering support.
  // Sets locale in async context so child server components don't need headers().
  setRequestLocale(locale);

  const messages = await getMessages({ locale });

  const gtmId      = process.env.NEXT_PUBLIC_GTM_ID;
  const gaId       = process.env.NEXT_PUBLIC_GA_ID;
  const hjId       = process.env.NEXT_PUBLIC_HOTJAR_ID;
  const isProd     = process.env.NODE_ENV === 'production';
  const themeStyle = await fetchSiteThemeStyle();

  return (
    <html lang={locale} className={`${inter.variable} ${playfair.variable}`}>
      {/* GTM script — injected into <head> as early as possible */}
      {isProd && gtmId && <GoogleTagManager gtmId={gtmId} />}
      <body className="font-sans bg-background text-secondary antialiased">
        {/* Site theme CSS vars — placed inside body so it comes after <link> stylesheets in cascade */}
        {themeStyle && (
          // eslint-disable-next-line react/no-danger -- server-generated CSS vars, not user input
          <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
        )}
        {/* GTM noscript fallback */}
        {isProd && gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        <OrganizationStructuredData />
        <WebsiteStructuredData />
        <NextAuthProvider>
        <ReactQueryProvider>
          <CurrencyProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
            <AffiliateTracker />
            {/* Module-level toast store — call toast.success/error anywhere, including outside React */}
            <ToastContainer />
            {/* Core Web Vitals reporting — logs in dev, sends to analytics in prod */}
            <WebVitals />
            <CookieConsentBanner />
            <Suspense fallback={null}><MetaPixel /></Suspense>
            <Suspense fallback={null}><PinterestTag /></Suspense>
          </NextIntlClientProvider>
          </CurrencyProvider>
        </ReactQueryProvider>
        </NextAuthProvider>
        {/* Direct GA4 tag — keep while GTM is being validated; remove once GTM is confirmed */}
        {isProd && gaId && <GoogleAnalytics gaId={gaId} />}
        {/* Hotjar — afterInteractive so it never blocks LCP */}
        {(() => {
          const hjSiteId = parseInt(hjId ?? '', 10);
          return isProd && !isNaN(hjSiteId) && hjSiteId > 0 ? (
            <Script
              id="hotjar"
              strategy="afterInteractive"
              // eslint-disable-next-line react/no-danger -- static inline analytics snippet, not user input
              dangerouslySetInnerHTML={{
                __html: `(function(h,o,t,j,a,r){
                  h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
                  h._hjSettings={hjid:${hjSiteId},hjsv:6};
                  a=o.getElementsByTagName('head')[0];
                  r=o.createElement('script');r.async=1;
                  r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
                  a.appendChild(r);
                })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`,
              }}
            />
          ) : null;
        })()}
      </body>
    </html>
  );
}
