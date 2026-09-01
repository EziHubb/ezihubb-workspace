import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '../../i18n/routing';
import { buildAlternates } from '../../lib/seo';
import { ReactQueryProvider } from '../../components/providers/ReactQueryProvider';
import { NextAuthProvider } from '../../components/providers/NextAuthProvider';
import { ToastContainer } from '../../components/ui/ToastContainer';
import { InboxToasts } from '../../components/messages/InboxToasts';
import { ChatDock } from '../../components/messages/ChatDock';
import { WebVitals } from '../../components/providers/WebVitals';
import { CookieConsentBanner } from '../../components/analytics/CookieConsentBanner';
import { PushPermissionPrompt } from '../../components/notifications/PushPermissionPrompt';
import { AppBadge } from '../../components/notifications/AppBadge';
import { ConsentAwareAnalytics } from '../../components/analytics/ConsentAwareAnalytics';
import { OrganizationStructuredData } from '../../components/seo/OrganizationStructuredData';
import { WebsiteStructuredData } from '../../components/seo/WebsiteStructuredData';
import { AffiliateTracker } from '../../components/providers/AffiliateTracker';
import { ApiLocaleSync } from '../../components/providers/ApiLocaleSync';
import { ServiceWorkerRegistrar } from '../../components/providers/ServiceWorkerRegistrar';
import { LocaleTransitionRestorer } from '../../components/providers/LocaleTransitionRestorer';
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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * themeColor lives here, not in metadata: Next moved it to the viewport
 * export and warns on the old placement. It paints the browser chrome and
 * the splash screen of the installed app.
 */
export const viewport: Viewport = {
  themeColor: '#E85D3F',
  width: 'device-width',
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'site' });
  const openGraphLocales: Record<string, string> = {
    en: 'en_US',
    vi: 'vi_VN',
    zh: 'zh_CN',
  };
  return {
    // NOTE: page-level `generateMetadata` (home, products, collections, etc.)
    // overrides `alternates` below with its own `buildAlternates(path, locale)`
    // call — this is only the fallback for routes that don't set their own
    // (e.g. `not-found.tsx`).
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
      locale:   openGraphLocales[locale] ?? 'en_US',
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
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: '/apple-touch-icon.png',
    },
    manifest: '/site.webmanifest',
    // iOS ignores the manifest's display mode and reads these instead.
    // Not cosmetic: iOS only delivers web push to a site the user has added
    // to the Home Screen, so without standalone capability there is no way
    // to receive a notification on an iPhone at all.
    appleWebApp: {
      capable: true,
      title: 'EziHubb',
      statusBarStyle: 'default',
    },
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      other: {
        // Pinterest domain verification. Hardcoded on purpose, unlike the
        // Google one above: the token is public by design (it is served in the
        // HTML to anyone), it never changes, and routing it through a
        // NEXT_PUBLIC_* var would add a fourth place it can silently go blank
        // — which is exactly what happened to NEXT_PUBLIC_PINTEREST_TAG_ID,
        // present in the Dockerfile and compose but missing from CI, so it
        // builds as an empty string with only a warning. A verification tag
        // that quietly disappears un-verifies the domain.
        'p:domain_verify': '6d886686d601fe034f8c0f0153593cce',
      },
    },
    alternates: buildAlternates('/', locale),
  };
}

async function fetchSiteThemeStyle(): Promise<string> {
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';
    const res = await fetch(`${apiBase}/api/v1/settings/theme`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return '';
    const json = (await res.json()) as {
      success: boolean;
      data: { primaryRgb?: string; primaryDark?: string; primaryLight?: string };
    };
    const { primaryRgb = '184 64 40', primaryDark = '#96351F', primaryLight = '#FFF0EC' } = json.data ?? {};
    const channels = primaryRgb
      .trim()
      .split(/\s+/)
      .map(Number);
    const relativeLuminance = ([red, green, blue]: number[]) => {
      const linear = [red, green, blue].map((value) => {
        const channel = value / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const whiteContrast = channels.length === 3 && channels.every((value) => Number.isFinite(value))
      ? 1.05 / (relativeLuminance(channels) + 0.05)
      : 0;
    // Keep store theming when it is readable. Otherwise fall back to the
    // closest accessible EziHubb coral rather than shipping unreadable CTAs.
    const accessiblePrimary = whiteContrast >= 5.5 ? primaryRgb : '184 64 40';
    const accessibleDark = whiteContrast >= 5.5 ? primaryDark : '#96351F';
    return `:root{--c-primary:${accessiblePrimary};--c-primary-dark:${accessibleDark};--c-primary-light:${primaryLight};}`;
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

  // Derived from routing.locales rather than spelled out: the literal union
  // here said 'en' | 'vi' while routing has carried 'zh' for a while, so the
  // type claimed a locale we ship is impossible. Runtime was unaffected,
  // which is exactly why it went unnoticed. This form cannot drift again.
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Required by next-intl v4 for static rendering support.
  // Sets locale in async context so child server components don't need headers().
  setRequestLocale(locale);

  const messages = await getMessages({ locale });
  const skipLabel = locale === 'vi'
    ? 'Bỏ qua đến nội dung chính'
    : locale === 'zh'
      ? '跳到主要内容'
      : 'Skip to main content';

  const themeStyle = await fetchSiteThemeStyle();

  return (
    <html lang={locale} className={`${inter.variable} ${playfair.variable}`}>
      <body className="font-sans bg-background text-secondary antialiased">
        <a
          href="#main-content"
          className="sr-only z-[10000] rounded-md bg-white px-4 py-2 text-secondary shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          {skipLabel}
        </a>
        {/* Site theme CSS vars — placed inside body so it comes after <link> stylesheets in cascade */}
        {themeStyle && (
          // eslint-disable-next-line react/no-danger -- server-generated CSS vars, not user input
          <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
        )}
        <OrganizationStructuredData />
        <WebsiteStructuredData />
        <NextIntlClientProvider messages={messages}>
        <NextAuthProvider>
        <ReactQueryProvider>
          <CurrencyProvider>
            <ApiLocaleSync />
            <LocaleTransitionRestorer />
            {children}
            <AffiliateTracker />
            {/* Module-level toast store — call toast.success/error anywhere, including outside React */}
            <ToastContainer />
            {/* Announces a shop reply on any page. Renders nothing, and opens
                no socket, for a visitor who is not signed in. */}
            <InboxToasts />
            {/* Floating conversation dock. Renders nothing for a signed-out
                visitor, and nothing on the inbox page itself. */}
            <ChatDock />
            {/* Core Web Vitals reporting — logs in dev, sends to analytics in prod */}
            <WebVitals />
            {/* Registers the service worker for everyone, signed in or not */}
            <ServiceWorkerRegistrar />
            <CookieConsentBanner />
            {/* Renders only once the cookie bar is answered — they share
                the same strip at the bottom of the page. */}
            <PushPermissionPrompt />
            {/* Writes the unread count onto the installed app icon. Renders
                nothing; the worker owns the same badge while the app is closed. */}
            <AppBadge />
            <ConsentAwareAnalytics />
          </CurrencyProvider>
        </ReactQueryProvider>
        </NextAuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
