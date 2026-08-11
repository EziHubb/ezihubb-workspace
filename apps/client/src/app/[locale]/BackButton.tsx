'use client';

import { useTranslations } from 'next-intl';

export function BackButton() {
  const t = useTranslations('errors');
  return (
    <button
      type="button"
      onClick={() => history.back()}
      className="inline-flex items-center justify-center gap-2 border border-border text-secondary font-semibold px-6 py-3 rounded-button hover:border-primary hover:text-primary transition-colors text-sm"
    >
      {t('goBack')}
    </button>
  );
}
