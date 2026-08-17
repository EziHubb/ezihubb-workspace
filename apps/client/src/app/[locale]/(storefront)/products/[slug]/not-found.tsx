import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import { PackageX } from 'lucide-react';

// When the product page body calls `notFound()` (e.g. a transient API
// failure), Next discards whatever `generateMetadata` in page.tsx returned
// and renders this boundary instead — which, without its own metadata,
// inherited the layout's indexable/homepage-canonical default. That's the
// likely mechanism behind real product URLs showing up in Search Console as
// "Crawled - currently not indexed": a momentary fetch failure served a
// thin, mis-canonicalized page that briefly looked indexable to Googlebot.
export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function ProductNotFound() {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations('errors'),
    getTranslations('common'),
    getLocale(),
  ]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col items-center justify-center min-h-[60vh] text-center py-20">
      <PackageX className="w-16 h-16 text-border mb-5" aria-hidden />

      <h1 className="font-display text-3xl font-bold text-secondary mb-3">
        {t('productNotFound')}
      </h1>
      <p className="text-muted mb-8 max-w-sm text-base">
        {t('productNotFoundDesc')}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/${locale}/search`}
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          {t('browseAllProductsCta')}
        </Link>
        <Link
          href={`/${locale}`}
          className="border border-border text-secondary font-semibold px-6 py-3 rounded-button hover:border-primary hover:text-primary transition-colors text-sm"
        >
          {tCommon('goHome')}
        </Link>
      </div>
    </div>
  );
}
