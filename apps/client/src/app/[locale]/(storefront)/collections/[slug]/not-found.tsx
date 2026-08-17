import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import { LayoutGrid } from 'lucide-react';

// See products/[slug]/not-found.tsx — without its own metadata, this
// boundary inherited the layout's indexable/homepage-canonical default.
export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function CollectionNotFound() {
  const [t, tCommon, locale] = await Promise.all([
    getTranslations('errors'),
    getTranslations('common'),
    getLocale(),
  ]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex flex-col items-center justify-center min-h-[60vh] text-center py-20">
      <LayoutGrid className="w-16 h-16 text-border mb-5" aria-hidden />

      <h1 className="font-display text-3xl font-bold text-secondary mb-3">
        {t('collectionNotFound')}
      </h1>
      <p className="text-muted mb-8 max-w-sm">
        {t('collectionNotFoundDesc')}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/${locale}/search`}
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          {t('shopAllProducts')}
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
