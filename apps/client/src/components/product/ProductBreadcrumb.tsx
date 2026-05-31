import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  name: string;
  href: string;
}

interface ProductBreadcrumbProps {
  items: BreadcrumbItem[];
}

export function ProductBreadcrumb({ items }: ProductBreadcrumbProps) {
  if (items.length === 0) return null;

  // Limit to 5 items max; if deeper, truncate the middle
  const MAX = 5;
  const visible: (BreadcrumbItem | '…')[] =
    items.length <= MAX
      ? items
      : [items[0], '…', ...items.slice(-(MAX - 2))];

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center flex-wrap gap-1 text-xs text-muted">
        {visible.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />}
            {item === '…' ? (
              <span>…</span>
            ) : i === visible.length - 1 ? (
              <span className="text-secondary font-medium truncate max-w-[160px]" aria-current="page">
                {item.name}
              </span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-primary transition-colors truncate max-w-[120px]"
              >
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
