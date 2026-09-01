/** Shapes returned by /admin/order-progress/*. */

export type StepKind =
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'CUSTOM'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED';

export interface ProgressStep {
  id:         string;
  name:       string;
  kind:       StepKind;
  sortOrder:  number;
  orderCount: number;
}

export interface QueueItem {
  id:              string;
  quantity:        number;
  name:            string;
  slug:            string | null;
  imageUrl:        string | null;
  sku:             string | null;
  variantName:     string | null;
  /** Free-form option map captured at order time — "Colour: Grey", "Size: L". */
  variantSnapshot: Record<string, unknown> | null;
  isPersonalized:  boolean;
}

export interface QueueOrder {
  id:          string;
  orderId:     string;
  orderNumber: string;
  status:      string;
  cancelledAt: string | null;
  cancelReason: string | null;
  step:        { id: string; name: string; kind: StepKind } | null;
  shipByDate:  string | null;
  orderedAt:   string;
  total:       number;
  shippingCost:   number;
  shippingSubsidy: number;
  shippingMethod: string | null;
  couponCode:  string | null;
  isGift:      boolean;
  note:        string | null;
  upgradeRequested: boolean;
  buyer:  { id: string | null; name: string | null };
  shipTo: {
    name:    string | null;
    address: string | null;
    city:    string | null;
    state:   string | null;
    zip:     string | null;
    country: string | null;
  };
  items: QueueItem[];
}

export interface QueueResponse {
  data: QueueOrder[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  cancelledCount: number;
}

export type ShipByBucket = 'all' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'none';

export interface QueueFilterState {
  shipBy:      ShipByBucket;
  destination: string;
  hasNote:     boolean;
  isGift:      boolean;
  isPersonalized:   boolean;
  upgradeRequested: boolean;
}

export const EMPTY_FILTERS: QueueFilterState = {
  shipBy:      'all',
  destination: '',
  hasNote:     false,
  isGift:      false,
  isPersonalized:   false,
  upgradeRequested: false,
};
