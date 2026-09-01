import { defineRouting } from 'next-intl/routing';

/**
 * Kept explicit because LocaleSwitcher updates the cookie before refreshing
 * the current RSC tree. The next-intl middleware reads the same cookie for
 * future unprefixed navigations.
 */
export const localeCookie = {
  name: 'NEXT_LOCALE',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
};

export const routing = defineRouting({
  locales: ['en', 'vi', 'zh'],
  defaultLocale: 'en',
  localeCookie,
});
