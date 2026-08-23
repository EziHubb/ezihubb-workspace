/**
 * The shape `/admin/orders/:id` returns, as the order detail page reads it.
 *
 * These lived in `OrderDrawer.tsx` alongside a component nothing rendered any
 * more — two unused sheets, ~53 KB, kept alive only because the live detail
 * page imported their types. The components are gone; the types stay here,
 * where nothing has to be deleted around them next time.
 */

export interface OrderItem {
  id:                 string;
  productId:          string;
  productName:        string;
  productSlug:        string;
  variantName?:       string;
  quantity:           number;
  unitPrice:          number;
  customizationData?: Record<string, unknown>;
  previewUrl?:        string;
  imageUrl?:          string;
}

export interface OrderDetail {
  id:              string;
  orderNumber:     string;
  status:          string;
  isDigital?:      boolean;
  total:           number;
  subtotal?:       number;
  shippingAmount?: number;
  discountAmount?: number;
  createdAt:       string;
  confirmedAt?:    string;
  shippedAt?:      string;
  deliveredAt?:    string;
  cancelledAt?:    string;
  trackingNumber?:  string;
  trackingCarrier?: string;
  shippingAddress: string | Record<string, unknown>;
  shippingMethod?: { name: string; carrier?: string };
  customer: {
    id:         string;
    firstName?: string | null;
    lastName?:  string | null;
    email:      string;
    phone?:     string | null;
  } | null;
  items: OrderItem[];
  statusHistory?: { status: string; createdAt: string; note?: string }[];
  isGift?:           boolean;
  giftMessage?:      string;
  giftFrom?:         string;
  giftReceipt?:      boolean;
  giftWrapping?:     boolean;
  labelUrl?:         string;
  labelPurchasedAt?: string;
}
