'use client';

import { memo, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MoreHorizontal, Package, Star, Eye, EyeOff, Copy, Archive } from 'lucide-react';
import { fmtAmount } from '../../lib/fmt';

export interface AdminProduct {
  id:             string;
  name:           string;
  slug:           string;
  basePrice:      number;
  compareAtPrice: number | null;
  primaryImageUrl: string | null;
  categoryName:   string;
  isActive:       boolean;
  status:         string;
  quantity:       number | null;
  isFeatured:     boolean;
  soldCount:      number;
  reviewCount:    number;
  averageRating:  number | null;
  createdAt:      Date | string;
}

interface ProductCardProps {
  product:        AdminProduct;
  selected:       boolean;
  anySelected:    boolean;
  onToggleSelect: (id: string) => void;
  onToggleActive: (p: AdminProduct) => void;
  onArchive:      (p: AdminProduct) => void;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  INACTIVE: 'bg-amber-100 text-amber-700',
  DRAFT:    'bg-gray-100 text-gray-600',
  ARCHIVED: 'bg-red-100 text-red-700',
};

function GearMenu({ product, onToggleActive, onArchive }: {
  product: AdminProduct;
  onToggleActive: (p: AdminProduct) => void;
  onArchive: (p: AdminProduct) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const itemCls = 'flex items-center gap-2 w-full px-3 py-2 text-sm text-secondary hover:bg-muted/8 transition-colors text-left';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-lg text-muted hover:text-secondary hover:bg-muted/10 transition-colors"
        title="More actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-50 w-40 bg-background border border-border rounded-xl shadow-lg overflow-hidden py-1">
          <Link
            href={`/products/${product.id}/edit`}
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            Edit listing
          </Link>
          <Link
            href={`/products/copy/${product.id}`}
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </Link>
          <button
            type="button"
            className={itemCls}
            onClick={() => { setOpen(false); onToggleActive(product); }}
          >
            {product.isActive
              ? <><EyeOff className="w-3.5 h-3.5" /> Unpublish</>
              : <><Eye className="w-3.5 h-3.5" /> Publish</>
            }
          </button>
          <div className="h-px bg-border mx-2 my-1" />
          <button
            type="button"
            className={`${itemCls} text-red-600 hover:bg-red-50`}
            onClick={() => { setOpen(false); onArchive(product); }}
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
          </button>
        </div>
      )}
    </div>
  );
}

export const ProductCard = memo(function ProductCard({
  product,
  selected,
  anySelected,
  onToggleSelect,
  onToggleActive,
  onArchive,
}: ProductCardProps) {
  const checkboxVisible = anySelected || selected;
  const statusLabel = product.status.charAt(0) + product.status.slice(1).toLowerCase();

  return (
    <div className={`relative group border rounded-xl bg-surface transition-all hover:shadow-md ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
      {/* Image area */}
      <div className="relative aspect-square rounded-t-xl overflow-hidden bg-muted/5">
        {product.primaryImageUrl ? (
          <Image
            src={product.primaryImageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 20vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="w-8 h-8 text-muted/40" />
          </div>
        )}

        {/* Checkbox overlay */}
        <div className={`absolute top-2 left-2 transition-opacity ${checkboxVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <label
            className="flex items-center justify-center w-5 h-5 rounded bg-white shadow cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(product.id)}
              className="sr-only"
            />
            <span className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center ${selected ? 'bg-primary border-primary' : 'border-gray-400 bg-white'}`}>
              {selected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
          </label>
        </div>

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-pill ${STATUS_STYLES[product.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {statusLabel}
          </span>
        </div>

        {/* Featured star */}
        {product.isFeatured && (
          <div className="absolute bottom-2 left-2">
            <span className="flex items-center gap-0.5 bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded-pill">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              Featured
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-semibold text-secondary line-clamp-2 leading-tight min-h-[2.5rem]">
          {product.name}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-secondary tabular-nums">
            {fmtAmount(product.basePrice)}
          </span>
          {product.quantity !== null && product.quantity !== undefined ? (
            <span className={`text-xs font-medium tabular-nums ${product.quantity === 0 ? 'text-red-600' : product.quantity < 5 ? 'text-amber-600' : 'text-muted'}`}>
              {product.quantity} in stock
            </span>
          ) : (
            <span className="text-xs text-muted">Unlimited</span>
          )}
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <Link
            href={`/products/${product.id}/edit`}
            className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Edit
          </Link>
          <GearMenu product={product} onToggleActive={onToggleActive} onArchive={onArchive} />
        </div>
      </div>
    </div>
  );
});
