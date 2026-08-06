// Shapes verified directly against Printify's published OpenAPI spec
// (https://developers.printify.com/openapi.json) — not guessed.

export interface PrintifyProductVariant {
  id:    number;
  title: string;
}

export interface PrintifyProduct {
  id:          string;
  title:       string;
  images?:     { src: string; is_default?: boolean }[];
  variants:    PrintifyProductVariant[];
}

export interface PrintifyPaginatedResponse<T> {
  current_page: number;
  data:         T[];
  last_page:    number;
  total:        number;
}

export interface PrintifyShop {
  id:          number;
  title:       string;
  sales_channel?: string;
}

export interface PrintifyAddressTo {
  first_name: string;
  last_name:  string;
  email?:     string;
  phone?:     string;
  country:    string;
  region?:    string;
  address1:   string;
  address2?:  string;
  city:       string;
  zip:        string;
}

export interface PrintifyLineItemByProduct {
  product_id: string;
  variant_id: number;
  quantity:   number;
}

export interface PrintifySubmitOrderRequest {
  external_id?:  string;
  label?:        string;
  line_items:    PrintifyLineItemByProduct[];
  address_to:    PrintifyAddressTo;
  shipping_method?: number;
}

export interface PrintifyOrderCreatedResponse {
  id: string;
}

export interface PrintifyOrder {
  id:     string;
  status: string;
}

export interface PrintifyShippingCostRequest {
  line_items: PrintifyLineItemByProduct[];
  address_to: PrintifyAddressTo;
}

export interface PrintifyShippingCosts {
  standard?: number;
  express?:  number;
  priority?: number;
  economy?:  number;
}

export interface PrintifyWebhook {
  id:      string;
  topic:   string;
  url:     string;
  shop_id: string;
}

/** Shared envelope for every webhook event type Printify sends. */
export interface PrintifyWebhookEvent<TData = Record<string, unknown>> {
  id:         string;
  type:       string;
  created_at: string;
  resource: {
    id:   string; // Printify's own order id
    type: string; // "order"
    data: TData;
  };
}

export interface PrintifyOrderShipmentCarrier {
  code:            string;
  tracking_number: string;
  tracking_url?:   string;
}

export interface PrintifyOrderUpdatedData     { shop_id: number; status: string }
export interface PrintifyOrderShipmentData    { shop_id: number; carrier: PrintifyOrderShipmentCarrier; skus: string[] }
