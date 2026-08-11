import { useTranslations } from 'next-intl';
import type { PaginationLabels } from '@ezihubb/ui';

/** Builds the translated `labels` prop for `@ezihubb/ui`'s <Pagination>. */
export function usePaginationLabels(): PaginationLabels {
  const t = useTranslations('common.pagination');
  return {
    navAria:      t('navAria'),
    previousAria: t('previousAria'),
    nextAria:     t('nextAria'),
    prev:         t('prev'),
    next:         t('next'),
    pageOf:       (page: number, total: number) => t('pageOf', { page, total }),
    pageAria:     (page: number) => t('pageAria', { page }),
  };
}
