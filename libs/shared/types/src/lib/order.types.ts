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
  id:            string;
  orderId:       string;
  productId:     string;
  variantId?:    string;
  variantName?:  string;
  quantity:      number;
  unitPrice:     number;
  totalPrice:    number;
  customization?: Record<string, unknown>;
  product?: {
    name:     string;
    slug:     string;
    imageUrl?: string;
  };
}

export interface OrderStatusHistoryDto {
  id:        string;
  orderId:   string;
  status:    OrderStatus;
  note?:     string;
  createdAt: string;
}

export interface OrderDto {
  id:              string;
  orderNumber:     string;
  userId?:         string;
  status:          OrderStatus;
  subtotal:        number;
  shippingCost:    number;
  discount:        number;
  giftCardDiscount: number;
  total:           number;
  currency:        string;
  couponCode?:     string;
  items:           OrderItemDto[];
  shippingAddress: {
    firstName:    string;
    lastName:     string;
    addressLine1: string;
    addressLine2?: string;
    city:         string;
    state:        string;
    postalCode:   string;
    country:      string;
    phone:        string;
  };
  trackingNumber?: string;
  trackingUrl?:    string;
  carrier?:        string;
  confirmedAt?:    string;
  notes?:          string;
  statusHistory?:  OrderStatusHistoryDto[];
  createdAt:       string;
  updatedAt:       string;
}
