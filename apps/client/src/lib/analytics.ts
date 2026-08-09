// Type-safe analytics — pushes to GTM dataLayer AND fires gtag directly.
// GTM is the primary container; gtag is a fallback for direct GA4 setups.

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    fbq: (...args: unknown[]) => void;
  }
}

// ── Core helpers ─────────────────────────────────────────────────────────────

// Typed alias so we don't conflict with Next.js's own dataLayer declaration
type DataLayer = Record<string, unknown>[];

function push(event: string, data: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  // Push to GTM dataLayer (primary)
  const w = window as typeof window & { dataLayer?: DataLayer };
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...data });
  // Also fire directly via gtag (redundancy while both GA4 + GTM are active)
  window.gtag?.('event', event, data);
}

function fbq(event: string, data?: Record<string, unknown>) {
  if (typeof window === 'undefined' || typeof window.fbq === 'undefined') return;
  window.fbq('track', event, data);
}

// ── E-commerce events (GA4 recommended) ──────────────────────────────────────

export const analytics = {

  viewItem(product: {
    id: string; name: string; category: string;
    price: number; currency?: string;
  }) {
    push('view_item', {
      currency: product.currency ?? 'USD',
      value: product.price,
      items: [{
        item_id:       product.id,
        item_name:     product.name,
        item_category: product.category,
        price:         product.price,
        quantity:      1,
      }],
    });
    fbq('ViewContent', { content_ids: [product.id], content_name: product.name, content_type: 'product', value: product.price, currency: product.currency ?? 'USD' });
  },

  addToCart(product: {
    id: string; name: string; category: string;
    price: number; quantity: number; variantId?: string;
  }) {
    push('add_to_cart', {
      currency: 'USD',
      value:    product.price * product.quantity,
      items: [{
        item_id:       product.id,
        item_name:     product.name,
        item_category: product.category,
        item_variant:  product.variantId,
        price:         product.price,
        quantity:      product.quantity,
      }],
    });
    fbq('AddToCart', { content_ids: [product.id], content_name: product.name, content_type: 'product', value: product.price * product.quantity, currency: 'USD' });
  },

  removeFromCart(product: {
    id: string; name: string; price: number; quantity: number;
  }) {
    push('remove_from_cart', {
      currency: 'USD',
      value:    product.price * product.quantity,
      items: [{
        item_id:   product.id,
        item_name: product.name,
        price:     product.price,
        quantity:  product.quantity,
      }],
    });
  },

  addToWishlist(product: { id: string; name: string; price: number }) {
    push('add_to_wishlist', {
      currency: 'USD',
      value:    product.price,
      items: [{ item_id: product.id, item_name: product.name, price: product.price }],
    });
  },

  beginCheckout(cart: { total: number; itemCount: number; coupon?: string }) {
    push('begin_checkout', {
      currency:  'USD',
      value:     cart.total,
      coupon:    cart.coupon,
      num_items: cart.itemCount,
    });
    fbq('InitiateCheckout', { value: cart.total, currency: 'USD', num_items: cart.itemCount });
  },

  addShippingInfo(cart: { total: number; shippingMethod: string }) {
    push('add_shipping_info', {
      currency:      'USD',
      value:         cart.total,
      shipping_tier: cart.shippingMethod,
    });
  },

  addPaymentInfo(cart: { total: number; paymentType: string }) {
    push('add_payment_info', {
      currency:     'USD',
      value:        cart.total,
      payment_type: cart.paymentType,
    });
  },

  purchase(order: {
    orderNumber: string; total: number; subtotal: number;
    shipping: number; coupon?: string;
    items: {
      id: string; name: string; category: string;
      price: number; quantity: number; variantId?: string;
    }[];
  }) {
    push('purchase', {
      transaction_id: order.orderNumber,
      currency:       'USD',
      value:          order.total,
      shipping:       order.shipping,
      coupon:         order.coupon,
      items: order.items.map((item) => ({
        item_id:       item.id,
        item_name:     item.name,
        item_category: item.category,
        item_variant:  item.variantId,
        price:         item.price,
        quantity:      item.quantity,
      })),
    });
    fbq('Purchase', { value: order.total, currency: 'USD', content_ids: order.items.map((i) => i.id), content_type: 'product' });
  },

  refund(order: { orderNumber: string; amount: number }) {
    push('refund', {
      transaction_id: order.orderNumber,
      currency:       'USD',
      value:          order.amount,
    });
  },

  // ── Custom events ─────────────────────────────────────────────────────────

  search(query: string, resultCount: number) {
    push('search', { search_term: query, result_count: resultCount });
    fbq('Search', { search_string: query });
  },

  openCustomizer(productId: string, productName: string) {
    push('open_customizer', { product_id: productId, product_name: productName });
  },

  generatePreview(productId: string) {
    push('generate_preview', { product_id: productId });
  },

  applyCoupon(code: string, discountAmount: number) {
    push('apply_coupon', { coupon_code: code, discount_amount: discountAmount });
  },

  signUp(method: 'email' | 'google') {
    push('sign_up', { method });
  },

  login(method: 'email' | 'google') {
    push('login', { method });
  },

  subscribe(location: string) {
    push('newsletter_subscribe', { location });
  },

  contactFormSubmit(subject: string) {
    push('contact_form_submit', { subject });
  },

  pageView(url: string, title: string) {
    push('page_view', { page_path: url, page_title: title });
  },
};
