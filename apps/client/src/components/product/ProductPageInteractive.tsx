'use client';

import { useState } from 'react';
import { SmartVariantPicker } from './SmartVariantPicker';
import { ProductActions } from './ProductActions';
import type { ProductDetailDto } from '../../app/[locale]/(storefront)/products/[slug]/page';
import type { ProductVariantDto } from '@ezihubb/types';

interface ProductPageInteractiveProps {
  product: ProductDetailDto;
  locale:  string;
}

export function ProductPageInteractive({
  product,
  locale,
}: ProductPageInteractiveProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantDto | null>(null);

  return (
    <>
      {/* Variant selection — SmartVariantPicker manages SizeGuideModal internally */}
      <SmartVariantPicker
        variantOptions={product.variantOptions ?? []}
        variants={product.variants ?? []}
        categorySlug={product.categorySlug}
        onVariantChange={setSelectedVariant}
        sizeGuide={product.sizeGuide}
      />

      {/* Action area — three flows: CustomizerPanel / ComingSoon / DirectAddToCart */}
      <ProductActions
        product={product}
        selectedVariant={selectedVariant}
        locale={locale}
      />
    </>
  );
}
