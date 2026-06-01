'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useMutateCart } from '@mlh/api-client';
import { VariantPicker } from './VariantPicker';
import { CustomizerPanel } from '../customizer/CustomizerPanel';
import { CartDrawer } from '../cart/CartDrawer';
import { useCartStore } from '../../lib/store/cart.store';
import type { ProductDetailDto } from '../../app/[locale]/(storefront)/products/[slug]/page';
import type { CustomizationTemplate } from '../../lib/customizer/types';
import type { FlexVariant, SelectedVariant, VariantOption } from './VariantPicker';

interface ProductPageInteractiveProps {
  product:  ProductDetailDto;
  template: CustomizationTemplate | null;
  locale:   string;
}

export function ProductPageInteractive({
  product,
  template,
  locale,
}: ProductPageInteractiveProps) {
  const [selectedVariant, setSelectedVariant] = useState<SelectedVariant | null>(null);
  const [cartOpen,        setCartOpen]        = useState(false);
  const [isLoggedIn,      setIsLoggedIn]      = useState(false);

  const { addItem } = useMutateCart();
  const openDrawer  = useCartStore((s) => s.openDrawer);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('access_token'));
  }, []);

  const effectivePrice =
    selectedVariant?.price !== undefined && selectedVariant.price > 0
      ? selectedVariant.price
      : product.basePrice;

  const handleSimpleAddToCart = () => {
    addItem.mutate(
      {
        productId: product.id,
        variantId: selectedVariant?.sku ?? null,
        quantity:  1,
      },
      {
        onSuccess: () => {
          // Desktop: open drawer; mobile: just navigate via cart link
          openDrawer();
        },
      },
    );
  };

  const isOutOfStock = selectedVariant?.isAvailable === false;

  // Map ProductVariantDto (typed) to FlexVariant used by VariantPicker
  const flexVariants: FlexVariant[] = (product.variants ?? []).map((v) => ({
    sku:           v.sku,
    options:       v.options,
    price:         typeof v.price === 'number' ? v.price : 0,
    compareAtPrice: v.compareAtPrice,
    isDefault:     v.isDefault,
    isAvailable:   v.isAvailable,
  }));

  // variantOptions comes from MongoDB (merged by the API into ProductDto)
  const variantOptions: VariantOption[] = product.variantOptions ?? [];

  return (
    <>
      <VariantPicker
        variantOptions={variantOptions}
        variants={flexVariants}
        onVariantChange={setSelectedVariant}
      />

      {/* Desktop: inline customizer */}
      {product.isPersonalizable && template ? (
        <div className="hidden md:block">
          <CustomizerPanel
            template={template}
            productId={product.id}
            productName={product.name}
            basePrice={effectivePrice}
            locale={locale}
            variantId={selectedVariant?.sku ?? null}
            isLoggedIn={isLoggedIn}
            onCartSuccess={() => openDrawer()}
          />
        </div>
      ) : (
        <div className="hidden md:block space-y-2">
          {addItem.isError && (
            <p className="text-sm text-error" role="alert">
              {addItem.error instanceof Error
                ? addItem.error.message
                : 'Failed to add to cart'}
            </p>
          )}
          <button
            type="button"
            onClick={handleSimpleAddToCart}
            disabled={addItem.isPending || isOutOfStock}
            className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
          >
            {isOutOfStock
              ? 'Out of Stock'
              : addItem.isPending
              ? 'Adding…'
              : `Add to Cart — $${effectivePrice.toFixed(2)}`}
          </button>
        </div>
      )}

      {/* Mobile: personalize link or simple add */}
      {product.isPersonalizable && template ? (
        <div className="md:hidden">
          <Link
            href={`/${locale}/products/${product.slug}/customize`}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
          >
            Personalize & Add to Cart
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="md:hidden space-y-2">
          {addItem.isError && (
            <p className="text-sm text-error" role="alert">
              {addItem.error instanceof Error
                ? addItem.error.message
                : 'Failed to add to cart'}
            </p>
          )}
          <button
            type="button"
            onClick={handleSimpleAddToCart}
            disabled={addItem.isPending || isOutOfStock}
            className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors disabled:opacity-50 uppercase tracking-wide"
          >
            {isOutOfStock
              ? 'Out of Stock'
              : addItem.isPending
              ? 'Adding…'
              : `Add to Cart — $${effectivePrice.toFixed(2)}`}
          </button>
        </div>
      )}

      {/* Cart drawer (product page level) */}
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
