'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function BackToResults() {
  const router = useRouter();
  const t = useTranslations('product.pdp');
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-xs text-muted hover:underline flex items-center gap-1"
    >
      {t('backToResults')}
    </button>
  );
}
