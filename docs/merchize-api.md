# Merchize API Reference

Consolidated from the seller's own Merchize dashboard (`seller.merchize.com/a/integrations/api` → "Merchize APIs Document"), gathered screenshot-by-screenshot during the design of the `MerchizeProvider` fulfillment integration (second provider alongside Printify, which stays the default). Field names and examples below are copied verbatim from Merchize's docs — nothing here is guessed.

## Auth

- **Base URL**: per-store, copied from the seller's own dashboard (Integrations → API). Example: `https://bo-group-1-2.merchize.com/hyyim1d/bo-api`. Not a fixed hostname — every seller has a different one.
- **Auth header**: `Authorization: Bearer {access_token}` on every request (confirmed on all endpoints below).
- The dashboard's "API Reference" page also mentions an "API Key" auth mode (separate tab from "Access Token"), but every real endpoint example uses `Authorization: Bearer {access_token}` — that's the one to implement.

**Relevant for our integration**: `apiKey` field on `DecryptedConnection` will hold the access_token; `externalShopId` will hold the full base URL (repurposed — Merchize has no separate numeric shop id like Printify).

---

## Orders API

### Create order — `POST /order/external/orders`

Imports an order with arbitrary/custom items (not required to pre-exist in Merchize's catalog).

Request body:

| Property | Type | Required | Description |
|---|---|---|---|
| order_id | string | Y | Order number in your system. Used later to retrieve tracking. |
| identifier | string | | Groups orders by tag. Imported order gets `api`/`api_{identifier}` tags. |
| shipping_info | object | Y | Shipping address of the order. |
| tags | array | | Tags of the order. |
| items | array | Y | Array of product items. |
| items[].name | string | | Title of product item. |
| items[].product_id | string | | ID of product item. Merchize uses this to match items across orders into one product. |
| items[].sku | string | | SKU of product item. |
| items[].merchize_sku | string | | Merchize SKU of product item — enables Merchize's statistics feature. |
| items[].price | number | | Price of product item. |
| items[].printing_method | string | | "DTG" or "DTF"; otherwise store default is used. |
| items[].currency | string | | Currency of item price. |
| items[].quantity | number | | Number of product items. |
| items[].image | string | Y | Preview image of the item — should match the imported product's image. |
| items[].design_front / design_back / design_sleeve / design_hood | string (url) | | Artwork URLs per side. |
| items[].attributes | array | Y | Detailed attributes of the item (e.g. size/color). |

Request example:
```
POST /order/external/orders
Content-Type: application/json
Authorization: Bearer {access_token}

{
  "order_id": "123",
  "identifier": "hello.com",
  "shipping_info": {
    "full_name": "John",
    "address_1": "123 ABC",
    "address_2": "",
    "city": "California",
    "state": "CA",
    "postcode": "12345",
    "country": "US",
    "email": "customer@example.com",
    "phone": "0123456789"
  },
  "tax": "" // optional, example: "123456789"
}
```

Response: `{ success, message, data: { status, is_deleted, hidden, is_enqueued, _id, type, data: { order_id, identifier, shipping_info, items[], tax, tags, created } } }`.

- `data._id` — Merchize's own unique id for the imported order.
- `data.data.order_id` — echoes back **our** `order_id`.
- No `code` (human-readable Merchize order number, e.g. `RX-XXXX-XXXX`) is returned here — but every other endpoint below accepts `external_number` (= our `order_id`) as an alternative lookup key to `code`, so we never need to capture `code` at all.

**Relevant for our integration**: this is `MerchizeProvider.createOrder()`. `order_id` = our `StoreOrderFulfillment.id` (the `referenceId` param). Since `external_number` works everywhere downstream, `createOrder()` should return `{ externalOrderId: referenceId, status: 'submitted' }` — i.e. we use our own reference id as the correlation key throughout, not Merchize's `_id`. This is safe specifically for Merchize (unlike Printify, which doesn't support external-id lookups at all).

⚠️ **Auto Fulfillment**: a fresh Merchize store shows "Auto Fulfillment: OFF" by default — imported orders sit un-fulfilled until either the seller enables Auto Fulfillment account-wide, or the `push` endpoint (below) is called per order. `createOrder()` should call `push` immediately after a successful create to guarantee production starts regardless of that setting.

### Create order from Merchize catalog — `POST /order/external/orders/catalog`

Same shape as above, but items reference an existing Merchize catalog product (via `product_id`/`sku`/`merchize_sku`) instead of carrying full custom artwork. Not used by our integration (we always go through the custom/external endpoint since our internal products aren't Merchize catalog entries).

### Import TikTok Shipping orders — `POST /order/external/tiktok-shipping/orders` (+ `.../catalog` variant)

Same order-import shape, plus `shipping_info.shipping_provider`, `shipping_info.shipping_label`, `shipping_info.tracking_number`, `shipping_info.merchize_warehouse`. TikTok-Shop-specific — not used by our integration.

### Import artwork set(s) — `POST /order/import/artworks`

Attaches artwork to an already-imported order's item by `items[].id` (from Get order detail). Not used in v1 — we send artwork inline via `design_front`/etc. on order creation instead.

### Get order detail — `GET /order/external/orders/order-detail`

Request header/query: `code` (Merchize's order number) **or** `external_number` + optional `identifier`.

```
GET /order/external/orders/order-detail?code=RX-XXXX-XXXX
Authorization: Bearer {access_token}
// or
GET /order/external/orders/order-detail?external_number=xxxxxx-xxxxxx&identifier=hello.com
Authorization: Bearer {access_token}
```

Response includes `data.order_status` (fulfillment status), `data.shipment_statuses` (array), `data.items[]` (title, sku, variant, attributes, price, quantity), `data.invoice`, `data.fulfillment_cost`.

**Relevant for our integration**: usable for `getOrderStatus()`, keyed by `external_number` = our reference id.

### Get list orders detail — `POST /order/external/orders/list-orders-detail`

Batch version of the above (`{ orders: [{ code, external_number, identifier }] }`). Not needed in v1 (we look up one order at a time).

### Get order invoice statistics / Get list orders invoice statistics

`GET /order/external/orders/order-invoice` / `POST /order/external/orders/list-orders-invoice` — billing breakdown (fulfillment cost, shipping cost, branding cost, paid status). Not used by our integration (no billing reconciliation in scope).

### Get order progress detail — `GET /order/external/orders/order-progress`

Same lookup params as order-detail. Response: `data[].order_progress[]` = `{ event, status, expected, actual }`, `data[].package_progresses[]` = `{ name, progress[] }`.

Confirmed **full event vocabulary** (from real webhook payloads, see below): `pushed_order`, `buyer_paid`, `fulfillment_cost_paid`, `in_production`, `shipment_started`, `in_transit`, `delivered`. `status` is `"done"` or `"pending"`.

**Relevant for our integration**: this is the authoritative source for fulfillment-stage mapping — used both for `getOrderStatus()`-style polling and to interpret webhook events without needing to parse every possible webhook shape.

### Get list orders progress detail — `POST /order/external/orders/list-orders-progress`

Batch version. Not needed in v1.

### Get order tracking / Get list orders tracking

`GET /order/external/orders/tracking` / `POST /order/external/orders/list-orders-tracking`. Response: `data[]` = `{ id, status, service, name, shipping_cost, created, items[] (production_time_max, currency, quantity, sku, fulfillment_cost, product_type, ffm_mapped_catalog_sku, variant_title), has_tracking }`. Note: **no explicit tracking number/carrier/url field** in this response shape — the real tracking number/carrier/url actually arrives via the `ORDER.CHANGED.TRACKING` webhook (see below), not this endpoint.

### Get list orders tickets detail — `POST /order/external/orders/list-orders-ticket`

Support-ticket history per order (Freshdesk-backed). Not used by our integration.

### Resume/Pause order — `POST /order/external/orders/update-order-status`

```json
{ "order": { "code": "RX-XXXX-XXXX", "external_number": "", "identifier": "", "action": "hold" } }
```
`action`: `"resume"` or `"hold"`. Not wired into `FulfillmentProvider` interface in v1 (no pause/resume concept there today) — noted for a possible future extension.

### Push order — `POST /order/external/orders/push`

```json
{ "order": { "code": "RX-XXXX-XXXX", "external_number": "", "identifier": "" } }
```
Forces an imported-but-not-yet-fulfilled order into production. **Relevant for our integration**: called immediately after `createOrder()` succeeds (see Auto Fulfillment note above). Failure here should be logged, not thrown — the order was still successfully created even if push fails, and the seller can push manually from their dashboard.

### Cancel order — `POST /order/external/orders/cancel`

```json
{ "order": { "code": "RX-XXXX-XXXX", "external_number": "", "identifier": "" } }
```
Response: `{ success: true, data: true }` (boolean). **Relevant for our integration**: this is `MerchizeProvider.cancelOrder()`, keyed by `external_number`.

### Tickets — Create / Update / Reopen / Resolve

- `POST /order/external/orders/ticket` — create (order_codes, category, subcategory, product_type, preferred, images, description).
- `PATCH /order/external/orders/ticket/{ticketId}` — add comment (`message`, `images`), reopen (`message`, `is_escalate`, `cf_satisfied`), or resolve (`resolved: "resolved"`).

Freshdesk-backed support ticketing. Not used by our integration.

---

## Products / Catalog API

None of this section is used by `MerchizeProvider` in v1 — our order-creation flow (`/order/external/orders`) doesn't require items to pre-exist as Merchize catalog products, so sellers don't need to create products through this API. Kept here for completeness/future reference.

### Create product — `POST /product/products/dropship/create`

Creates a new sellable product in the seller's Merchize storefront: `title`, `description`, `attributes[]` (name/type/values, types: `slide`/`color`/`size`/`label`), `variants[]` (options, retail_price, sku, sku_seller, currency, is_default), `collections[]`, `tags[]`, visibility flags (`is_featured`, `is_shop_hidden`, `is_stealthy`, `is_collection_hidden`).

### Create collection — `POST /product/v2/collections`

`name`, `description`, `template` (`default`/`gallery`), `type` (`manual`/`automated`), `rules[]` (`{ column: "tag", relation: "equals", condition }`), `disjunctive` (AND/OR combine), `is_featured`, `facebook_pixel_id`.

### Upload artworks — `POST /artwork/artworks?product_id={id}`

Multipart binary upload of `front`/`back`/`sleeve`/`hood` files for a catalog product.

### Upload variant images — `POST /product/variants/{variant_id}/image`

Multipart binary upload (`images`) of a mockup for a specific variant. Response: `{ side, thumb }`.

### Get all variants — `GET /product/products/{product_id}/all-variants`

Lists variants of **one specific known product_id** — not a "list all products in my shop" endpoint. Response per variant: `_id`, `sides[]`, `image_uris[]`, `retail_price`, `is_default`, `sku`, `title`, `weight`, `options[]` (with nested `attribute: { name, value_type }`), `image`.

### Get collections — `POST /product/v2/collections/search`

Paginated collection search (`limit`, `name`, `page`).

### Get Merchize product catalog — `GET /product/catalog`

**The one Products-API endpoint that matters for our integration.** Returns Merchize's global blank-product catalog (not per-seller) — e.g. blank garments available for print-on-demand.

Query: `limit` (max 50, default 50), `page` (default 1), `search` (by SKU, comma-separated for multiple).

```
GET /product/catalog?limit=50&page=1&search=LHSYVN,ALPSVN
Authorization: Bearer {access_token}
```

Response per product: `_id`, `title`, `sku`, `printing_methods[]` (e.g. `["DTF","DTG"]`), `fulfillment_location: { name, code }`, `mockup_and_templates_link`, `attributes[]` (`name`, `type`, `values[]`), `variants[]`:
- `variants[]._id`, `.sku` (e.g. `LSRLVN000000AA00`)
- `variants[].attributes[]` = `{ name, type, value_text, value_code }` (e.g. `{ name: "size", value_text: "XS", value_code: "xs" }`)
- `variants[].shipping_prices[]` = `{ to_zone, to_country, first_item, additional_item }` — e.g. zones `US`/`EU`/`ROW`, with `to_country: "all"` as each zone's fallback row and specific country codes/lists for EU sub-rates.
- `variants[].tiers[]` = `{ name, price }` — base pricing tiers (`tier1`/`tier2`/`tier3`, `dtf_tier*`, `dtg_tier*`).

**Relevant for our integration**: this is the real, verified source for both:
1. `listShopProducts()` — search by SKU to populate the existing shop-product picker UI (`FulfillmentTab.tsx`'s `ShopProductPickerModal`, already built for Printify) with real Merchize catalog products/variants for mapping.
2. `getShippingRateCents()` — sum `first_item + (qty-1)*additional_item` from the matching variant's `shipping_prices` entry for the destination country (exact `to_country` match first, else the `to_country: "all"` row for the `ROW` zone as the final catch-all).

`ProductFulfillmentMapping.externalProductId`/`.externalVariantId` map naturally to the catalog's parent `sku` and variant `sku` respectively — no schema change needed.

---

## Webhooks

**Registration**: unlike Printify, Merchize has **no API to programmatically register a webhook** — subscriptions are configured manually in the seller dashboard (Settings → Webhook → "Add webhook": URL + event checkboxes + enabled toggle). `MerchizeProvider.registerWebhooks()`/`unregisterWebhooks()` are therefore no-ops; sellers must paste our callback URL into their own Merchize dashboard, and we surface that URL to them after connecting.

**Verification**: a store-wide secret is generated once via Settings → Webhook → "Add secret Key". Every webhook request carries it back verbatim in a header:

```
merchize-webhook-key: {secretKey}
```

This is a direct shared-secret comparison, not an HMAC signature — verify by comparing the header value to the stored secret. Retry policy: max 5 attempts/day over 3 days; the endpoint must respond `200`.

**Common envelope** (present in every event type): `event_type`, `event_id`, `event_time`, `resource: { ... }`. `resource.external_number` (= our own order reference id passed as `order_id` at creation) is present on every order-related event — this is the correlation key, confirmed present even on the minimal `ORDER.CREATED` payload.

### ORDER.CREATED

`resource`: `order_code`, `external_number`, `identifier`, `payment_status`, `shipping_info { full_name, email, phone, address, address2, city, state, country, country_code, postal_code }`, `items[] { _id, title, image, price, quantity, currency, attributes[] { name, option } }`.

### ORDER.CHANGED.TRACKING

Fires when tracking info is added/updated. `resource`: `order_code`, `external_number`, `identifier`, `_id`, `status`, `service`, `shipping_cost`, `created`, **`tracking_company`, `tracking_number`, `tracking_url`**, `updated`, `items[]`, `has_tracking`, `supplier`.

```json
{
  "event_type": "ORDER.CHANGED.TRACKING",
  "resource": {
    "order_code": "RX-XXXX-XXXX", "external_number": "xxxx-xxxx", "identifier": "hello.com",
    "status": "paid", "_id": "123", "service": "Merchize", "shipping_cost": 1, "created": "",
    "tracking_company": "example company", "tracking_number": "123",
    "tracking_url": "https://example.com/?trackingnumber=123", "updated": "...",
    "items": [{ "currency": "USD", "quantity": 1, "ffm_discount_amount": 0, "sku": "custom-product-12-black",
      "fulfillment_cost": "123", "order_item": "12", "product_type": "Product type", "variant_title": "Example title" }],
    "has_tracking": true, "supplier": "US"
  },
  "event_id": "123", "event_time": "..."
}
```

**Relevant for our integration**: primary source for updating `StoreOrder.trackingNumber` / `.trackingUrl` / `.carrier` — no extra API round-trip needed, unlike the tracking GET endpoint which lacks these fields.

### ORDER.CHANGED.SHIPMENT

Fires when shipment status changes. `resource`: `order_code`, `external_number`, `identifier`, `_id`, `status`, `service`, `package_code`, `old_shipment_status`, `new_shipment_status` (e.g. `pre_transit` → `in_transit`), `supplier`, `shipment_histories { date, location, status, message }`, `created`, `updated`.

### ORDER.CHANGED.PROGRESS

Fires on any order-progress change. `resource`: `order_code`, `external_number`, `identifier`, `order_progress[] { event, status, expected, actual }`, `package_progresses[] { name, progress[] { event, status, actual, expected_days }, supplier }`.

Confirmed full `event` vocabulary from a real example: `pushed_order`, `buyer_paid`, `fulfillment_cost_paid`, `in_production`, `shipment_started`, `delivered` (order-level); `buyer_paid`, `fulfillment_cost_paid`, `in_production`, `shipment_started`, `in_transit`, `delivered` (package-level). `status` is `done` or `pending`.

**Relevant for our integration**: this is the definitive event-name → fulfillment-stage mapping table for both this webhook and `GET order-progress` polling.

### ORDER.CHANGED.PROGRESS_STATUS

`resource`: `order_code`, `external_number`, `identifier`, `old_status`, `new_status` (e.g. `hold` → `open` — mirrors the Resume/Pause order action).

### ORDER.PAYMENT.TRANSACTION_FEE / FULFILLMENT_COST / FULFILLMENT_COST_PAID / REFUND / SURCHARGE

Billing/invoice events (`transaction_id`, `price`, `currency`, `status`, `paid_at`, `paid_by_method`, cost breakdowns). Out of scope — no billing reconciliation in our `FulfillmentProvider` interface.

### ORDER.ISSUE.UPDATED

Fires when a support ticket's status changes. `resource`: `orders[]`, `category[]`, `product_type[]`, `ticket_status`, `is_read_ticket`, `prefer_solution`, `last_message { ... }`. Out of scope (ticketing).

### ORDER.INVALID.ADDRESS

Fires when an order's shipping address is flagged invalid. `resource`: `code`, `external_number`, `identifier`, `type_invalid` (enum: `invalid`, `inactive`, `missing_secondary`, `street_undefined`, `vacant`, `zipcode_undefined`, `spelling`), `message_invalid`.

**Relevant for our integration**: actionable — map to `FulfillmentStatus.FAILED` (mirrors how Printify's `canceled` status is handled), logging `type_invalid`/`message_invalid`.

### ORDER.IMPORTER.ERROR

Fires when async order import fails **after** the create-order API already returned success. `resource`: `status` (`failed`), `external_number`, `identifier`, `type` (import source enum: `amazon`, `api`, `csv_merchize`, `ebay`, `etsy`, `fba`, `shopbase`, `shopify`, `woocommerce`), `created`, `error` (message).

**Relevant for our integration**: important edge case — a 200 response from `createOrder()` doesn't guarantee the order actually landed. Map to `FulfillmentStatus.FAILED`, log `error`.

---

## Summary: what `MerchizeProvider` actually uses

| Interface method | Endpoint(s) |
|---|---|
| `verifyConnection` | No dedicated endpoint exists — probe with `GET order-detail?external_number=__probe__` (any well-formed JSON response confirms auth+URL are valid); shop name derived from the base URL's path slug (no shop-info endpoint). |
| `listShopProducts` | `GET /product/catalog?search=...` |
| `createOrder` | `POST /order/external/orders` then `POST /order/external/orders/push` |
| `getOrderStatus` | `GET /order/external/orders/order-progress` |
| `cancelOrder` | `POST /order/external/orders/cancel` |
| `getShippingRateCents` | Computed from `GET /product/catalog`'s `variants[].shipping_prices` |
| `registerWebhooks` / `unregisterWebhooks` | No-ops — manual dashboard configuration only |
| `parseWebhookPayload` | Common envelope (`event_type`, `resource.external_number`) — see Webhooks section |

Everything else documented above (Products/Collections/Artwork-upload/Tickets/Payment-billing events/TikTok-specific endpoints) is out of scope for the fulfillment integration.
