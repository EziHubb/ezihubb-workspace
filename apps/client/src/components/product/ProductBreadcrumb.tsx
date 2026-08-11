import { Fragment } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export interface BreadcrumbItem {
  name: string;
  href: string;
}

interface ProductBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function ProductBreadcrumb({ items }: ProductBreadcrumbProps) {
  const t = useTranslations('product.pdp');
  if (items.length === 0) return null;

  // Truncate middle when more than 5 crumbs — keep first + last 3
  const MAX = 5;
  const visible: (BreadcrumbItem | null)[] =
    items.length <= MAX
      ? items
      : [items[0], null, ...items.slice(-(MAX - 2))];

  return (
    <nav aria-label={t('breadcrumb')} className="flex items-center gap-1 text-xs text-muted flex-wrap">
      {visible.map((item, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>›</span>}
          {item === null ? (
            <span>…</span>
          ) : i === visible.length - 1 ? (
            <span className="text-secondary" aria-current="page">
              {item.name}
            </span>
          ) : (
            <Link href={item.href} className="hover:underline hover:text-secondary transition-colors">
              {item.name}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
