import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-6">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
          )}
          {index === items.length - 1 ? (
            <span className="text-[var(--color-secondary)] font-medium">
              {item.label}
            </span>
          ) : (
            <a
              href={item.href}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              {item.label}
            </a>
          )}
        </div>
      ))}
    </nav>
  );
}
