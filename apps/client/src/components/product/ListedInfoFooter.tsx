import { Fragment } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ProductDto } from '@ezihubb/types';
import type { BreadcrumbItem } from './ProductBreadcrumb';

// ── Props ─────────────────────────────────────────────────────────────────────

interface ListedInfoFooterProps {
  product:     ProductDto;
  breadcrumbs: BreadcrumbItem[];
  locale?:     string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ListedInfoFooter({
  product,
  breadcrumbs,
  locale,
}: ListedInfoFooterProps) {
  const t = useTranslations('product.pdp');
  return (
    <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

      {/* Left: listing meta */}
      <div className="text-xs text-muted">
        {t('listingNumber', { id: product.id.slice(-8).toUpperCase() })}
        {' · '}
        <Link
          href={locale ? `/${locale}/report?product=${product.id}` : '#'}
          className="hover:underline"
        >
          {t('reportItem')}
        </Link>
      </div>

      {/* Right: breadcrumb trail */}
      <nav aria-label={t('listingLocation')} className="flex flex-wrap gap-1 text-xs text-muted">
        {breadcrumbs.map((crumb, i) => (
          <Fragment key={crumb.href}>
            {i > 0 && <span aria-hidden>›</span>}
            <Link href={crumb.href} className="hover:underline hover:text-secondary">
              {crumb.name}
            </Link>
          </Fragment>
        ))}
      </nav>

    </div>
  );
}
