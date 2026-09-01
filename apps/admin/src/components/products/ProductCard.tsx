'use client';

import { memo, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal, Package, Star, Eye, EyeOff, Copy, Archive,
  Pencil, ExternalLink, BarChart2, RefreshCw, Layers, Share2,
  Trash2,
} from 'lucide-react';
import { Menu, type MenuItemDef } from '@ezihubb/ui';
import { fmtAmount } from '../../lib/fmt';
import { ADMIN_ROUTES } from '@ezihubb/constants';
import { useDialog } from '../../contexts/DialogContext';
import { toast } from '../../lib/store/toast.store';

export interface AdminProduct {
  id:              string;
  name:            string;
  slug:            string;
  basePrice:       number;
  compareAtPrice:  number | null;
  minPrice:        number | null;
  maxPrice:        number | null;
  /** The auto-apply sale in force, or null. Distinct from compareAtPrice,
   *  which is the seller's own "was" price and unrelated to any sale.
   *
   *  The API has been sending this all along; it was absent from this type,
   *  so the card showed a full price for a listing the storefront was
   *  already discounting. */
  sale?:           { price: number; originalPrice: number; discountPercent: number } | null;
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
  const router = useRouter();
  const { alert } = useDialog();

  const handleShare = async () => {
    const url = `${clientBaseUrl ?? ''}/products/${product.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    } catch (err) {
      await alert((err as Error).message || 'Could not copy the link.', { variant: 'error' });
    }
  };

  const items: MenuItemDef[] = [
    { label: 'View on site', icon: <ExternalLink className="w-3.5 h-3.5" />, onClick: () => window.open(`${clientBaseUrl ?? ''}/products/${product.slug}`, '_blank', 'noopener,noreferrer') },
    { label: 'View stats',   icon: <BarChart2 className="w-3.5 h-3.5" />,    onClick: () => router.push(ADMIN_ROUTES.STATS_LISTING(product.id)) },
    { label: 'Edit',         icon: <Pencil className="w-3.5 h-3.5" />,       onClick: () => router.push(`/products/${product.id}/edit`) },
    { label: 'Copy',         icon: <Copy className="w-3.5 h-3.5" />,         onClick: () => router.push(`/products/copy/${product.id}`) },
    {
      label:   product.isActive ? 'Deactivate' : 'Activate',
      icon:    product.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />,
      onClick: () => onToggleActive(product),
    },
    // Renew — placeholder (for future listing renewal)
    { label: 'Renew',          icon: <RefreshCw className="w-3.5 h-3.5" />, onClick: () => undefined },
    { label: 'Change section', icon: <Layers className="w-3.5 h-3.5" />,    onClick: () => router.push(`/products/${product.id}/edit?tab=settings`) },
    { label: 'Share',          icon: <Share2 className="w-3.5 h-3.5" />,    onClick: handleShare },
    { label: 'Archive', icon: <Archive className="w-3.5 h-3.5" />, warning: true, onClick: () => onArchive(product) },
    // Delete — only once the product is already Archived (hard-delete is
    // irreversible; archive first is the review step before that)
    ...(onDelete && product.status === 'ARCHIVED'
      ? [{ label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, destructive: true, onClick: () => onDelete(product) }]
      : []),
  ];

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Menu
        align="end"
        placement="top"
        panelWidth="12rem"
        trigger={
          <span className="p-1.5 rounded-lg text-muted hover:text-secondary hover:bg-muted/10 transition-colors" title="More actions">
            <MoreHorizontal className="w-4 h-4" />
          </span>
        }
        items={items}
      />
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
  const lowestPrice     = product.minPrice ?? product.basePrice;
  const hasPriceRange   = product.minPrice != null
    && product.maxPrice != null
    && product.minPrice !== product.maxPrice;

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
        {/* The same sticker the storefront shows, in the one corner this
            card has free. A seller looking at their grid should see the
            listing the way a shopper does. */}
        {product.sale && product.sale.discountPercent > 0 && (
          <div className="absolute bottom-2 left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-badge-sale text-white shadow-md ring-2 ring-white">
            <span className="text-xs font-extrabold leading-none tracking-tight">-{product.sale.discountPercent}%</span>
          </div>
        )}

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
        <h3 className="h-9 overflow-hidden break-words text-sm font-semibold leading-[1.125rem] text-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {product.name}
        </h3>

        <div className="flex items-center justify-between">
          {/* Matches the storefront exactly: a discounted price is
              badge-sale red, the old one is struck and muted, and the
              percentage is muted text rather than a competing accent. A
              seller comparing the two views should not see two prices. */}
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span className={`tabular-nums ${product.sale ? 'text-lg font-extrabold text-badge-sale' : 'text-base font-bold text-secondary'}`}>
              {hasPriceRange && <span className="mr-1 text-xs font-normal text-muted">From</span>}
              {fmtAmount(product.sale ? product.sale.price : lowestPrice)}
            </span>
            {/* No percentage here: it is the sticker on the image. */}
            {product.sale && (
              <span className="text-sm text-muted line-through decoration-1 tabular-nums">
                {fmtAmount(product.sale.originalPrice)}
              </span>
            )}
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
