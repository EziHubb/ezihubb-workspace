'use client';

import { memo, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal, Package, Star, Eye, EyeOff, Copy, Archive,
  Pencil, ExternalLink, BarChart2, RefreshCw, Layers, Share2,
  Trash2, Check,
} from 'lucide-react';
import { fmtAmount } from '../../lib/fmt';
import { ADMIN_ROUTES } from '@ezihubb/constants';
import { useDialog } from '../../contexts/DialogContext';

export interface AdminProduct {
  id:              string;
  name:            string;
  slug:            string;
  basePrice:       number;
  compareAtPrice:  number | null;
  primaryImageUrl: string | null;
  categoryName:    string;
  isActive:        boolean;
  status:          string;
  quantity:        number | null;
  isFeatured:      boolean;
  soldCount:       number;
  reviewCount:     number;
  averageRating:   number | null;
  createdAt:       Date | string;
}

interface ProductCardProps {
  product:           AdminProduct;
  selected:          boolean;
  anySelected:       boolean;
  onToggleSelect:    (id: string) => void;
  onToggleActive:    (p: AdminProduct) => void;
  onArchive:         (p: AdminProduct) => void;
  onToggleFeatured?: (p: AdminProduct, newValue: boolean) => void;
  onDelete?:         (p: AdminProduct) => void;
  clientBaseUrl?:    string;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  INACTIVE: 'bg-amber-100 text-amber-700',
  DRAFT:    'bg-gray-100 text-gray-600',
  ARCHIVED: 'bg-red-100 text-red-700',
};

// ── Gear menu ─────────────────────────────────────────────────────────────────

function GearMenu({
  product,
  onToggleActive,
  onArchive,
  onToggleFeatured,
  onDelete,
  clientBaseUrl,
}: {
  product:          AdminProduct;
  onToggleActive:   (p: AdminProduct) => void;
  onArchive:        (p: AdminProduct) => void;
  onToggleFeatured?: (p: AdminProduct, newValue: boolean) => void;
  onDelete?:        (p: AdminProduct) => void;
  clientBaseUrl?:   string;
}) {
  const [open,    setOpen]    = useState(false);
  const [copied,  setCopied]  = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { alert } = useDialog();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const itemCls      = 'flex items-center gap-2.5 w-full px-3 py-2 text-sm text-secondary hover:bg-muted/8 transition-colors text-left';
  const dangerItemCls = `${itemCls} text-error hover:bg-error/5`;

  const handleShare = async () => {
    const url = `${clientBaseUrl ?? ''}/products/${product.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      await alert((err as Error).message || 'Could not copy the link.', { variant: 'error' });
    }
    setOpen(false);
  };

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
        <div
          className="absolute right-0 bottom-full mb-1 z-50 w-48 bg-background border border-border rounded-xl shadow-xl overflow-hidden py-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* View on site */}
          <a
            href={`${clientBaseUrl ?? ''}/products/${product.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <ExternalLink className="w-3.5 h-3.5 text-muted" />
            View on site
          </a>

          {/* View stats */}
          <Link
            href={ADMIN_ROUTES.STATS_LISTING(product.id)}
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <BarChart2 className="w-3.5 h-3.5 text-muted" />
            View stats
          </Link>

          <div className="h-px bg-border mx-2 my-1" />

          {/* Edit */}
          <Link
            href={`/products/${product.id}/edit`}
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <Pencil className="w-3.5 h-3.5 text-muted" />
            Edit
          </Link>

          {/* Copy */}
          <Link
            href={`/products/copy/${product.id}`}
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <Copy className="w-3.5 h-3.5 text-muted" />
            Copy
          </Link>

          {/* Activate / Deactivate */}
          <button
            type="button"
            className={itemCls}
            onClick={() => { setOpen(false); onToggleActive(product); }}
          >
            {product.isActive
              ? <><EyeOff className="w-3.5 h-3.5 text-muted" /> Deactivate</>
              : <><Eye className="w-3.5 h-3.5 text-muted" /> Activate</>
            }
          </button>

          {/* Renew — placeholder (for future listing renewal) */}
          <button
            type="button"
            className={itemCls}
            onClick={() => { setOpen(false); }}
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted" />
            Renew
          </button>

          {/* Change section */}
          <Link
            href={`/products/${product.id}/edit?tab=settings`}
            className={itemCls}
            onClick={() => setOpen(false)}
          >
            <Layers className="w-3.5 h-3.5 text-muted" />
            Change section
          </Link>

          {/* Share */}
          <button
            type="button"
            className={itemCls}
            onClick={handleShare}
          >
            {copied
              ? <><Check className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">Link copied!</span></>
              : <><Share2 className="w-3.5 h-3.5 text-muted" /> Share</>
            }
          </button>

          <div className="h-px bg-border mx-2 my-1" />

          {/* Archive */}
          <button
            type="button"
            className={`${itemCls} text-amber-600 hover:bg-amber-50`}
            onClick={() => { setOpen(false); onArchive(product); }}
          >
            <Archive className="w-3.5 h-3.5" />
            Archive
          </button>

          {/* Delete — only once the product is already Archived (hard-delete is
              irreversible; archive first is the review step before that) */}
          {onDelete && product.status === 'ARCHIVED' && (
            <button
              type="button"
              className={dangerItemCls}
              onClick={() => { setOpen(false); onDelete(product); }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────

export const ProductCard = memo(function ProductCard({
  product,
  selected,
  anySelected,
  onToggleSelect,
  onToggleActive,
  onArchive,
  onToggleFeatured,
  onDelete,
  clientBaseUrl,
}: ProductCardProps) {
  const router          = useRouter();
  const checkboxVisible = anySelected || selected;
  const statusLabel     = product.status.charAt(0) + product.status.slice(1).toLowerCase();

  // Optimistic featured state with debounce
  const [optimisticFeatured, setOptimisticFeatured] = useState(product.isFeatured);
  const featuredDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when server data refreshes
  useEffect(() => {
    setOptimisticFeatured(product.isFeatured);
  }, [product.isFeatured]);

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleFeatured) return;
    const next = !optimisticFeatured;
    setOptimisticFeatured(next);
    if (featuredDebounceRef.current) clearTimeout(featuredDebounceRef.current);
    featuredDebounceRef.current = setTimeout(() => {
      onToggleFeatured(product, next);
    }, 500);
  };

  return (
    <div
      className={`relative group border rounded-xl bg-surface transition-all hover:shadow-md cursor-pointer ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}
      onClick={() => router.push(`/products/${product.id}/edit`)}
    >
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
              {selected && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
                  <path d="M1.5 5l2.5 2.5L8.5 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
          </label>
        </div>

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-pill ${STATUS_STYLES[product.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {statusLabel}
          </span>
        </div>

        {/* Clickable star (feature toggle) — optimistic + debounced */}
        {onToggleFeatured && (
          <button
            type="button"
            onClick={handleStarClick}
            className={[
              'absolute bottom-2 left-2 p-1 rounded-full transition-all',
              optimisticFeatured
                ? 'text-amber-500 opacity-100'
                : 'text-white/70 hover:text-amber-400 opacity-0 group-hover:opacity-100',
            ].join(' ')}
            title={optimisticFeatured ? 'Unpin from shop top' : 'Pin to shop top'}
          >
            <Star
              className={`w-5 h-5 drop-shadow-sm transition-all ${optimisticFeatured ? 'fill-amber-400 text-amber-500 scale-110' : 'fill-black/20 text-white scale-100'}`}
            />
          </button>
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
          {/* Stats mini */}
          <div className="flex items-center gap-2 text-xs text-muted">
            {product.soldCount > 0 && (
              <span title="Sales">{product.soldCount} sold</span>
            )}
            {product.averageRating !== null && product.averageRating !== undefined && (
              <span className="flex items-center gap-0.5" title="Rating">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {product.averageRating.toFixed(1)}
              </span>
            )}
          </div>
          <GearMenu
            product={product}
            onToggleActive={onToggleActive}
            onArchive={onArchive}
            onToggleFeatured={onToggleFeatured}
            onDelete={onDelete}
            clientBaseUrl={clientBaseUrl}
          />
        </div>
      </div>
    </div>
  );
});
