'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Heart, ShoppingCart, HeartOff } from 'lucide-react';
import { queryKeys, useMutateCart } from '@mlh/api-client';
import { useToast } from '@mlh/ui';
import type { WishlistItemDto } from '@mlh/types';
import { useAuthQuery, useAuthMutation } from '../../../../../lib/hooks/useAuthQuery';
import { apiClient } from '@mlh/api-client';

// ── Wishlist product card ─────────────────────────────────────────────────────

function WishlistCard({
  item,
  locale,
  onRemove,
  onAddToCart,
  isRemovingId: removingId,
  isAddingId:   addingId,
}: {
  item:           WishlistItemDto;
  locale:         string;
  onRemove:       (productId: string) => void;
  onAddToCart:    (productId: string) => void;
  isRemovingId:   string | null;
  isAddingId:     string | null;
}) {
  const p = item.product;

  return (
    <article className="relative border border-border rounded-card overflow-hidden hover:shadow-card-hover transition-shadow">
      {/* Image */}
      <Link href={`/${locale}/products/${p.slug}`} className="block relative aspect-[4/5] overflow-hidden bg-background">
        <Image
          src={p.imageUrl ?? 'https://placehold.co/400x500.png?text=No+Image'}
          alt={p.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover hover:scale-105 transition-transform duration-300"
        />
      </Link>

      {/* Remove from wishlist */}
      <button
        type="button"
        onClick={() => onRemove(p.id)}
        disabled={removingId === p.id}
        aria-label="Remove from wishlist"
        className="absolute top-2 right-2 p-2 rounded-full bg-white/90 backdrop-blur-sm shadow-sm text-error hover:bg-error hover:text-white transition-colors disabled:opacity-50"
      >
        <Heart className="w-4 h-4 fill-current" />
      </button>

      {/* Info */}
      <div className="p-3 md:p-4 space-y-3">
        <Link href={`/${locale}/products/${p.slug}`}>
          <h3 className="text-sm font-medium text-secondary hover:text-primary transition-colors line-clamp-2 leading-snug">
            {p.name}
          </h3>
        </Link>
        <p className="text-sm font-bold text-secondary tabular-nums">
          ${p.basePrice.toFixed(2)}
        </p>

        {/* Add to Cart */}
        <button
          type="button"
          onClick={() => onAddToCart(p.id)}
          disabled={addingId === p.id || !p.isActive}
          className="w-full flex items-center justify-center gap-1.5 py-2 border border-primary text-primary text-xs font-semibold rounded-button hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          {addingId === p.id
            ? 'Adding…'
            : p.isActive
            ? 'Add to Cart'
            : 'Out of Stock'}
        </button>
      </div>
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WishlistPage() {
  const locale       = useLocale();
  const toast = useToast();

  const { data: items = [], isLoading } = useAuthQuery<WishlistItemDto[]>(
    queryKeys.wishlist(),
    '/users/me/wishlist',
  );

  const removeMutation = useAuthMutation(
    (productId: string, token: string) =>
      apiClient.delete<void>(`/users/me/wishlist/${productId}`, { token }),
    {
      invalidateKeys: [queryKeys.wishlist()],
      onSuccess:      () => toast.info('Removed from wishlist'),
    },
  );

  const { addItem } = useMutateCart();

  const removingId =
    removeMutation.isPending ? (removeMutation.variables as string) : null;
  const addingId   =
    addItem.isPending ? (addItem.variables as { productId: string }).productId : null;

  const handleRemove = (productId: string) => {
    removeMutation.mutate(productId);
  };

  const handleAddToCart = (productId: string) => {
    addItem.mutate(
      { productId, quantity: 1 },
      {
        onSuccess: () => toast.success('Added to cart!'),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to add to cart'),
      },
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-secondary">Wishlist</h1>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse border border-border rounded-card overflow-hidden">
              <div className="aspect-[4/5] bg-border/30" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-border/30 rounded w-3/4" />
                <div className="h-4 bg-border/30 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <HeartOff className="w-14 h-14 text-muted/30" aria-hidden />
          <div>
            <p className="font-semibold text-secondary text-base">Nothing saved yet</p>
            <p className="text-sm text-muted mt-1">
              Heart products you love and find them here later.
            </p>
          </div>
          <Link
            href={`/${locale}/products`}
            className="mt-2 bg-primary hover:bg-primary-dark text-white font-bold text-sm px-6 py-3 rounded-button transition-colors uppercase tracking-wide"
          >
            Explore Gifts
          </Link>
        </div>
      )}

      {/* Grid */}
      {!isLoading && items.length > 0 && (
        <>
          <p className="text-sm text-muted">
            <span className="font-semibold text-secondary">{items.length}</span>{' '}
            saved item{items.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {items.map((item: WishlistItemDto) => (
              <WishlistCard
                key={item.id}
                item={item}
                locale={locale}
                onRemove={handleRemove}
                onAddToCart={handleAddToCart}
                isRemovingId={removingId}
                isAddingId={addingId}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
