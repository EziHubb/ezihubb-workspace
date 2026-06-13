export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'DISPUTED';

export interface OrderItemDto {
  id: string;
  productId: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  customizationData?: Record<string, unknown>;
  previewUrl?: string;
  // backward compat
  /** @deprecated use customizationData */
  customization?: Record<string, unknown>;
  totalPrice: number;
  product?: {
    name: string;
    slug: string;
    imageUrl?: string;
  };
}

export interface OrderStatusHistoryDto {
  id: string;
  orderId: string;
  status: OrderStatus;
  note?: string;
  createdAt: string;
}

/** Lightweight summary returned by the list endpoint (GET /orders/me). */
export interface OrderListItemDto {
  id:           string;
  orderNumber:  string;
  status:       OrderStatus;
  total:        number;
  itemCount:    number;
  previewUrl:   string | null;
  createdAt:    string | Date;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  guestEmail?: string;
  // New flat shipping fields
  shippingName: string;
  shippingCity: string;
  shippingState?: string;
  shippingZip: string;
  shippingCountry: string;
  shippingMethod: string;
  shippingCost: number;
  subtotal: number;
  discountAmount?: number;
  total: number;
  couponCode?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  items: OrderItemDto[];
  createdAt: string;
  confirmedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  // backward compat — existing components access shippingAddress as nested object
  shippingAddress: {
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  discount: number;
  giftCardDiscount: number;
  currency?: string;
  notes?: string;
  statusHistory?: OrderStatusHistoryDto[];
  userId?: string;
  updatedAt?: string;
}
