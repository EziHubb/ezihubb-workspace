import { FulfillmentProviderType } from '@prisma/client';

/** Structurally compatible with orders/dto/checkout.dto.ts's ShippingAddressDto —
 *  kept as a local shape (not imported) so `fulfillment` never depends on `orders`. */
export interface FulfillmentAddress {
  fullName:      string;
  phone:         string;
  addressLine1:  string;
  addressLine2?: string;
  city:          string;
  state?:        string;
  postalCode:    string;
  country:       string;
  /** Required by some providers' order-create payload (e.g. Merchize); Printify ignores it. */
  email?:        string;
}

export interface FulfillmentLineItem {
  externalProductId: string;
  externalVariantId: string;
  quantity:           number;
  /** Product display name — required by some providers' order-create payload (e.g. Merchize); Printify ignores it. */
  title?:             string;
  /** Preview/print image URL — required by some providers' order-create payload (e.g. Merchize); Printify ignores it. */
  imageUrl?:          string;
}

export interface ShopProductVariantSummary {
  externalVariantId: string;
  title:              string;
}

export interface ShopProductSummary {
  externalProductId: string;
  title:              string;
  thumbnailUrl?:      string;
  variants:           ShopProductVariantSummary[];
}

/** Decrypted, call-ready connection — never persisted, only exists for the
 *  duration of one provider call. */
export interface DecryptedConnection {
  connectionId:   string;
  apiKey:         string;
  externalShopId: string;
}

export interface CreateOrderResult {
  externalOrderId: string;
  status:           string;
}

export interface WebhookRegistration {
  /** Provider-side webhook subscription ids, kept so they can be torn down on disconnect. */
  externalWebhookIds: string[];
}

export interface ParsedWebhookEvent {
  /** The provider's own order id — NOT necessarily anything we sent them.
   *  (Printify does not echo back an external_id in webhook payloads —
   *  correlation must happen via the provider's own order id, which we
   *  captured from createOrder()'s response.) */
  externalOrderId: string;
  eventType:        string;
  raw:              unknown;
}

/**
 * Contract every fulfillment (print-on-demand) provider must implement.
 * Adding a new provider = a new class implementing this + one new
 * FulfillmentProviderType enum value — no other code changes.
 */
export interface FulfillmentProvider {
  readonly type: FulfillmentProviderType;

  /** Verifies an API key + shop id are valid; returns the shop's display name. */
  verifyConnection(apiKey: string, externalShopId: string): Promise<{ shopName: string }>;

  /** Lists products already published in the seller's own shop on this provider —
   *  does NOT create/publish new products (that's a separate, larger feature). */
  listShopProducts(conn: DecryptedConnection): Promise<ShopProductSummary[]>;

  /** `referenceId` is passed through as the provider's own "external reference"
   *  field if it has one (useful for audit trails / provider-side idempotency) —
   *  it is NOT relied upon for webhook correlation, since not every provider
   *  echoes it back (Printify doesn't). Correlation uses the provider's own
   *  order id from CreateOrderResult instead. */
  createOrder(
    conn: DecryptedConnection,
    referenceId: string,
    items: FulfillmentLineItem[],
    shipTo: FulfillmentAddress,
  ): Promise<CreateOrderResult>;

  getOrderStatus(conn: DecryptedConnection, externalOrderId: string): Promise<{ status: string }>;

  cancelOrder(conn: DecryptedConnection, externalOrderId: string): Promise<void>;

  getShippingRateCents(
    conn: DecryptedConnection,
    items: FulfillmentLineItem[],
    addressTo: FulfillmentAddress,
  ): Promise<number>;

  /** Subscribes `callbackUrl` to every order-status topic this provider supports.
   *  No signature/secret is exchanged here — see fulfillment-webhook module docs
   *  for why (Printify's webhook API has no signing mechanism; the callback URL
   *  itself carries an opaque per-connection token instead). */
  registerWebhooks(conn: DecryptedConnection, callbackUrl: string): Promise<WebhookRegistration>;

  unregisterWebhooks(conn: DecryptedConnection, externalWebhookIds: string[]): Promise<void>;

  parseWebhookPayload(rawBody: Buffer): ParsedWebhookEvent;
}

export const FULFILLMENT_PROVIDERS = Symbol('FULFILLMENT_PROVIDERS');
