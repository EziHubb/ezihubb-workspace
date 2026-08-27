/** Shapes returned by /admin/order-progress/orders/:storeOrderId*. */

import type { StepKind } from '../queue/types';

export interface PanelItemFile {
  name: string;
  url:  string;
  /**
   * True when the file lives in our own storage. `customizationData` is
   * written by the client at add-to-cart time, so a buyer controls these
   * strings — only an own-storage file is fetched as an image or offered as a
   * link. The rest are shown as plain text, so nothing the buyer submitted
   * goes missing without a request being made to an address they chose.
   */
  isOwn: boolean;
}

export interface PanelItem {
  id:              string;
  quantity:        number;
  name:            string;
  slug:            string | null;
  imageUrl:        string | null;
  sku:             string | null;
  variantName:     string | null;
  variantSnapshot: Record<string, unknown> | null;
  personalization: { label: string; value: string }[];
  files:           PanelItemFile[];
  lineTotal:       number;
}

/**
 * `source` is carried through to the UI on purpose: a window the carrier
 * quoted and one derived from the shop's own delivery profile are different
 * promises, and the seller should be able to tell which one they are looking
 * at before repeating it to a buyer.
 */
export interface DeliveryWindow {
  min:    string;
  max:    string;
  source: 'carrier' | 'profile';
}

export interface OrderPanelDetail {
  id:          string;
  orderId:     string;
  orderNumber: string;
  /** This shop's own state for its share of the basket. */
  status:      string;
  /** The buyer-facing lifecycle, shared by every shop in the basket. */
  orderStatus: string;
  step:        { id: string; name: string; kind: StepKind } | null;
  shop:        { id: string; name: string; slug: string };
  orderedAt:   string;
  shipByDate:  string | null;
  isGift:      boolean;
  giftMessage: string | null;
  buyerNote:   string | null;
  privateNote: string | null;
  itemCount:   number;
  total:       number;

  buyer: {
    id:        string | null;
    name:      string | null;
    email:     string | null;
    avatarUrl: string | null;
    isGuest:   boolean;
  };

  shipTo: {
    name:    string | null;
    phone:   string | null;
    address: string | null;
    city:    string | null;
    state:   string | null;
    zip:     string | null;
    country: string | null;
  };

  delivery: {
    methodName: string | null;
    cost:       number;
    window:     DeliveryWindow | null;
  };

  items: PanelItem[];

  receipt: {
    itemTotal:  number;
    discount:   number;
    couponCode: string | null;
    subtotal:   number;
    postage:    number;
    total:      number;
    paidVia:    string | null;
    paidAt:     string | null;
  };
}

export interface OrderPanelEarnings {
  buyerPaid: {
    total:      number;
    itemsPrice: number;
    postage:    number;
    discount:   number;
    couponCode: string | null;
    subtotal:   number;
  };
  fees: {
    total: number;
    lines: { type: string; label: string; amount: number }[];
  };
  youEarned: number;
  /** No ledger rows yet — the order has not been paid for. */
  pending:   boolean;
}

export interface PanelMessage {
  id:             string;
  senderType:     'CUSTOMER' | 'SHOP';
  body:           string;
  attachmentUrls: string[];
  createdAt:      string;
  isRead:         boolean;
  /** Set when the shop unsent it; the body comes back empty with it. */
  deletedAt?: string | null;
}

export interface OrderPanelThread {
  conversationId: string | null;
  messages:       PanelMessage[];
}
