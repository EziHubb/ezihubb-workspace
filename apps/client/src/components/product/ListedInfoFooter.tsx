import { Fragment } from 'react';
import Link from 'next/link';
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
  return (
    <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">

      {/* Left: listing meta */}
      <div className="text-xs text-muted">
        Listing #{product.id.slice(-8).toUpperCase()}
        {' · '}
        <Link
          href={locale ? `/${locale}/report?product=${product.id}` : '#'}
          className="hover:underline"
        >
          Report this item
        </Link>
      </div>

      {/* Right: breadcrumb trail */}
      <nav aria-label="Listing location" className="flex flex-wrap gap-1 text-xs text-muted">
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
