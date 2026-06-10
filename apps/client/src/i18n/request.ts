import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

// Các namespace tương ứng với từng file trong messages/{locale}/
const NAMESPACES = [
  'site',
  'nav',
  'footer',
  'home',
  'customizer',
  'orderTracking',
  'common',
  'errors',
  'collections',
  'occasions',
  'product',
  'cart',
  'checkout',
  'account',
] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale    = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  // Load song song tất cả namespace rồi gộp lại thành một object duy nhất
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => {
      const mod = await import(`../../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );

  return {
    locale,
    messages: Object.fromEntries(entries),
  };
});
