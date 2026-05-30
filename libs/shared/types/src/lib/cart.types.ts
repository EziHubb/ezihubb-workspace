// ── Cart totals breakdown ─────────────────────────────────────────────────────

export interface CartTotals {
  subtotal:  number;
  discount:  number;
  shipping:  number;
  total:     number;
  itemCount: number;
}

// ── Cart item (richer than the bare DB row — includes denormalised product/variant) ──

export interface CartItemDto {
  id:              string;
  cartId:          string;
  productId:       string;
  productName:     string;
  productSlug:     string;
  productImageUrl: string | null;
  variantId:       string | null;
  variantName:     string | null;
  quantity:        number;
  /** Price at the time the item was added to the cart */
  unitPrice:       number;
  /** Current live price of the product */
  currentPrice:    number;
  totalPrice:      number;
  /** true when unitPrice !== currentPrice (i.e. price changed since item was added) */
  priceChanged:    boolean;
  customizationData?: Record<string, unknown>;
  previewUrl?:     string | null;
}

// ── Cart ──────────────────────────────────────────────────────────────────────

export interface CartDto {
  id:             string;
  userId?:        string;
  sessionId?:     string;
  items:          CartItemDto[];
  couponCode:     string | null;
  discountAmount: number | null;
  totals:         CartTotals;
  updatedAt:      string;
}
