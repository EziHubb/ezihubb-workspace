'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';

export interface ProductAttribute {
  key:        string;
  value:      string;
  unit?:      string;
  filterable?: boolean;
}

interface ProductAttributeListProps {
  attributes: ProductAttribute[];
}

export function ProductAttributeList({ attributes }: ProductAttributeListProps) {
  const t = useTranslations('product.specs');
  const [open, setOpen] = useState(true);

  const visible = attributes.filter((a) => a.key && a.value);
  if (visible.length === 0) return null;

  return (
    <div className="border border-border rounded-card overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 bg-background hover:bg-muted/5 transition-colors text-left"
      >
        <span className="font-semibold text-sm text-secondary">{t('title')}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <dl className="divide-y divide-border">
          {visible.map((attr) => (
            <div key={attr.key} className="grid grid-cols-2 px-4 py-2.5 text-sm">
              <dt className="font-medium text-secondary">{attr.key}</dt>
              <dd className="text-muted">
                {attr.value}{attr.unit ? ` ${attr.unit}` : ''}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
