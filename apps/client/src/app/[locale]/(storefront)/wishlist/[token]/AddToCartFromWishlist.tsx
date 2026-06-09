'use client';

import { ShoppingCart } from 'lucide-react';
import { useMutateCart } from '@mlh/api-client';
import { useToast } from '@mlh/ui';

// Only active products are returned by the public wishlist endpoint
export function AddToCartFromWishlist({ productId }: { productId: string }) {
  const { addItem } = useMutateCart();
  const toast       = useToast();

  const isPending =
    addItem.isPending &&
    (addItem.variables as { productId: string } | undefined)?.productId === productId;

  const handleAdd = () => {
    addItem.mutate(
      { productId, quantity: 1 },
      {
        onSuccess: () => toast.success('Added to cart!'),
        onError:   (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to add to cart'),
      },
    );
  };

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={isPending}
      className="w-full flex items-center justify-center gap-1.5 py-2 border border-primary text-primary text-xs font-semibold rounded-button hover:bg-primary hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <ShoppingCart className="w-3.5 h-3.5" />
      {isPending ? 'Adding…' : 'Add to Cart'}
    </button>
  );
}
