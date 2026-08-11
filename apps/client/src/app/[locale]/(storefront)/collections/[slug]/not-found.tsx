import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LayoutGrid } from 'lucide-react';

export default async function CollectionNotFound() {
  const [t, tCommon] = await Promise.all([
    getTranslations('errors'),
    getTranslations('common'),
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
          href="/search"
          className="bg-primary hover:bg-primary-dark text-white font-semibold px-6 py-3 rounded-button transition-colors text-sm uppercase tracking-wide"
        >
          {t('shopAllProducts')}
        </Link>
        <Link
          href="/"
          className="border border-border text-secondary font-semibold px-6 py-3 rounded-button hover:border-primary hover:text-primary transition-colors text-sm"
        >
          {tCommon('goHome')}
        </Link>
      </div>
    </div>
  );
}
