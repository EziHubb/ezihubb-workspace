import type { ProductImageDto } from './product.types';

export interface CartItemDto {
  id: string;
  productId: string;
  productType?: 'PHYSICAL' | 'DIGITAL';
  product: {
    name: string;
    slug: string;
    images: ProductImageDto[];
  };
  variantId?: string;
  variant?: { options: Record<string, string>; sku: string };
  quantity: number;
  unitPrice: number;
  /** Current live price — used for price-change detection */
  currentPrice: number;
  customizationData?: Record<string, unknown>;
  previewUrl?: string;
  // backward compat — existing components use flat fields
  /** @deprecated use product.name */
  productName: string;
  /** @deprecated use product.slug */
  productSlug: string;
  /** @deprecated use product.images[0].url */
  productImageUrl: string | null;
  /** @deprecated use variant.options */
  variantName: string | null;
  variantOptions?: Record<string, string> | null;
  /** @deprecated compare unitPrice vs currentPrice */
  priceChanged: boolean;
  totalPrice: number;
  cartId?: string;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemCount: number;
  /** Platform-wide threshold in USD; zero means the policy is disabled. */
  freeShippingThreshold?: number;
  freeShippingEligible?: boolean;
}

export interface CartDto {
  id: string;
  items: CartItemDto[];
  couponCode?: string;
  discountAmount: number;
  subtotal: number;
  itemCount: number;
  /** backward compat — existing components access cart.totals.{itemCount,subtotal,total} */
  totals: CartTotals;
  userId?: string;
  sessionId?: string;
  updatedAt?: string;
}
