// Every shape below was verified directly against the seller's own Merchize
// dashboard API docs (see docs/merchize-api.md at the repo root) — not guessed.

export interface MerchizeApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ─── Orders: create ─────────────────────────────────────────────────────────

export interface MerchizeShippingInfo {
  full_name: string;
  address_1: string;
  address_2?: string;
  city:       string;
  state?:     string;
  postcode:   string;
  country:    string;
  email:      string;
  phone:      string;
}

export interface MerchizeOrderItemAttribute {
  name:   string;
  option: string;
}

export interface MerchizeCreateOrderItem {
  name?:            string;
  product_id?:      string;
  sku?:             string;
  merchize_sku?:    string;
  printing_method?: string;
  quantity:         number;
  image:            string;
  design_front?:    string;
  design_back?:     string;
  design_sleeve?:   string;
  design_hood?:     string;
  attributes:       MerchizeOrderItemAttribute[];
}

export interface MerchizeCreateOrderRequest {
  order_id:      string;
  identifier?:   string;
  shipping_info: MerchizeShippingInfo;
  items:         MerchizeCreateOrderItem[];
}

export interface MerchizeCreateOrderResponseData {
  _id:    string;
  status: string;
}

export interface MerchizeOrderRefRequest {
  order: { code?: string; external_number: string; identifier?: string };
}

// ─── Orders: progress ───────────────────────────────────────────────────────

export interface MerchizeOrderProgressEntry {
  event:     string;
  status:    string; // "done" | "pending"
  expected?: string;
  actual?:   string;
}

export interface MerchizeOrderProgressData {
  code:             string;
  external_number:  string;
  order_progress:   MerchizeOrderProgressEntry[];
}

// ─── Product catalog ────────────────────────────────────────────────────────

export interface MerchizeCatalogShippingPrice {
  to_zone:          string;
  to_country:       string;
  first_item:       number;
  additional_item:  number;
}

export interface MerchizeCatalogVariantAttribute {
  name:       string;
  type:       string;
  value_text: string;
  value_code: string;
}

export interface MerchizeCatalogVariant {
  _id:             string;
  sku:             string;
  attributes:      MerchizeCatalogVariantAttribute[];
  shipping_prices: MerchizeCatalogShippingPrice[];
}

export interface MerchizeCatalogProduct {
  _id:      string;
  title:    string;
  sku:      string;
  variants: MerchizeCatalogVariant[];
}

export interface MerchizeCatalogResponseData {
  page:     number;
  limit:    number;
  total:    number;
  products: MerchizeCatalogProduct[];
}

// ─── Webhooks ───────────────────────────────────────────────────────────────

export interface MerchizeWebhookEnvelope<T = Record<string, unknown>> {
  event_type: string;
  event_id:   string;
  event_time: string;
  resource:   T;
}

export interface MerchizeCorrelatableResource {
  external_number: string;
}

export interface MerchizeTrackingResource extends MerchizeCorrelatableResource {
  order_code:        string;
  status?:           string;
  tracking_company?: string;
  tracking_number?:  string;
  tracking_url?:     string;
  has_tracking?:     boolean;
}

export interface MerchizeShipmentResource extends MerchizeCorrelatableResource {
  order_code:            string;
  old_shipment_status?:  string;
  new_shipment_status?:  string;
}

export interface MerchizeProgressResource extends MerchizeCorrelatableResource {
  order_code:      string;
  order_progress:  MerchizeOrderProgressEntry[];
}

export interface MerchizeInvalidAddressResource extends MerchizeCorrelatableResource {
  code:             string;
  type_invalid:     string;
  message_invalid:  string;
}

export interface MerchizeImporterErrorResource extends MerchizeCorrelatableResource {
  status: string;
  type:   string;
  error:  string;
}
