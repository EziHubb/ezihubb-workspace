import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { FulfillmentProviderType } from '@prisma/client';
import {
  DecryptedConnection,
  FulfillmentAddress,
  FulfillmentLineItem,
  FulfillmentProvider,
  ParsedWebhookEvent,
  ShopProductSummary,
  WebhookRegistration,
} from '../interfaces/fulfillment-provider.interface';
import {
  MerchizeApiResponse,
  MerchizeCatalogResponseData,
  MerchizeCatalogShippingPrice,
  MerchizeCatalogVariant,
  MerchizeCorrelatableResource,
  MerchizeCreateOrderItem,
  MerchizeCreateOrderRequest,
  MerchizeCreateOrderResponseData,
  MerchizeOrderProgressData,
  MerchizeOrderRefRequest,
  MerchizeWebhookEnvelope,
} from './merchize.types';

const CATALOG_PAGE_SIZE = 50;

/**
 * Merchize implementation of FulfillmentProvider. Every request/response shape
 * below was verified against the seller's own dashboard API docs (see
 * docs/merchize-api.md at the repo root) — not guessed. Two structural
 * differences from Printify:
 *
 * 1. Merchize's order lookups (detail/progress/tracking/cancel/push) all
 *    accept `external_number` (our own reference id) directly — unlike
 *    Printify, which never echoes back a caller-supplied id. So `createOrder`
 *    can safely return the caller's own `referenceId` as `externalOrderId`.
 * 2. Merchize has no webhook-registration API at all — subscriptions are
 *    configured manually in the seller's dashboard. `registerWebhooks`/
 *    `unregisterWebhooks` are therefore no-ops (see fulfillment-webhook.guard.ts
 *    for how the `merchize-webhook-key` header is verified instead).
 *
 * `DecryptedConnection.externalShopId` is repurposed to hold the full,
 * per-store base URL (e.g. https://bo-group-1-2.merchize.com/hyyim1d/bo-api)
 * — Merchize has no separate numeric shop id like Printify.
 */
@Injectable()
export class MerchizeProvider implements FulfillmentProvider {
  readonly type = FulfillmentProviderType.MERCHIZE;

  private readonly logger  = new Logger(MerchizeProvider.name);
  private readonly timeout = 10_000;

  private client(baseUrl: string, accessToken: string) {
    return axios.create({
      baseURL: baseUrl.replace(/\/$/, ''),
      timeout: this.timeout,
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }

  async verifyConnection(apiKey: string, externalShopId: string): Promise<{ shopName: string }> {
    // No dedicated account/shop-info endpoint exists — any well-formed JSON
    // response from a real endpoint proves the base URL + token combination
    // is valid (a wrong URL/token throws instead, caught by the caller).
    await this.client(externalShopId, apiKey).get<MerchizeApiResponse<unknown>>(
      '/order/external/orders/order-detail',
      { params: { external_number: '__verify_connection_probe__' } },
    );
    return { shopName: this.shopNameFromBaseUrl(externalShopId) };
  }

  private shopNameFromBaseUrl(baseUrl: string): string {
    try {
      const url = new URL(baseUrl);
      const segments = url.pathname.split('/').filter(Boolean).filter((s) => s !== 'bo-api');
      return segments[0] ?? url.hostname;
    } catch {
      return baseUrl;
    }
  }

  async listShopProducts(conn: DecryptedConnection): Promise<ShopProductSummary[]> {
    const { data } = await this.client(conn.externalShopId, conn.apiKey).get<MerchizeApiResponse<MerchizeCatalogResponseData>>(
      '/product/catalog',
      { params: { limit: CATALOG_PAGE_SIZE, page: 1 } },
    );
    return data.data.products.map((p) => ({
      externalProductId: p.sku,
      title:              p.title,
      variants:           p.variants.map((v) => ({
        externalVariantId: v.sku,
        title:              v.attributes.map((a) => a.value_text).join(' / ') || v.sku,
      })),
    }));
  }

  private async findCatalogVariant(
    client: ReturnType<typeof this.client>,
    parentSku: string,
    variantSku: string,
  ): Promise<MerchizeCatalogVariant | undefined> {
    const { data } = await client.get<MerchizeApiResponse<MerchizeCatalogResponseData>>('/product/catalog', {
      params: { search: parentSku },
    });
    const product = data.data.products.find((p) => p.sku === parentSku);
    return product?.variants.find((v) => v.sku === variantSku);
  }

  async createOrder(
    conn: DecryptedConnection,
    referenceId: string,
    items: FulfillmentLineItem[],
    shipTo: FulfillmentAddress,
  ) {
    if (!shipTo.email) {
      throw new Error('Merchize requires a shipping email address, which is missing on this order');
    }

    const client = this.client(conn.externalShopId, conn.apiKey);

    const orderItems: MerchizeCreateOrderItem[] = await Promise.all(
      items.map(async (item) => {
        if (!item.imageUrl) {
          throw new Error(`Merchize requires a preview image per item — "${item.title ?? item.externalProductId}" has none`);
        }

        let attributes: MerchizeCreateOrderItem['attributes'] = [];
        try {
          const variant = await this.findCatalogVariant(client, item.externalProductId, item.externalVariantId);
          attributes = (variant?.attributes ?? []).map((a) => ({ name: a.name, option: a.value_code }));
        } catch (err) {
          this.logger.warn(`Failed to fetch Merchize catalog attributes for ${item.externalVariantId}: ${(err as Error).message}`);
        }
        if (attributes.length === 0) {
          attributes = [{ name: 'variant', option: item.externalVariantId }];
        }

        return {
          name:         item.title,
          product_id:   item.externalProductId,
          sku:          item.externalVariantId,
          merchize_sku: item.externalVariantId,
          quantity:     item.quantity,
          image:        item.imageUrl,
          design_front: item.imageUrl,
          attributes,
        } satisfies MerchizeCreateOrderItem;
      }),
    );

    const body: MerchizeCreateOrderRequest = {
      order_id: referenceId,
      shipping_info: {
        full_name: shipTo.fullName,
        address_1: shipTo.addressLine1,
        address_2: shipTo.addressLine2,
        city:      shipTo.city,
        state:     shipTo.state,
        postcode:  shipTo.postalCode,
        country:   shipTo.country,
        email:     shipTo.email,
        phone:     shipTo.phone,
      },
      items: orderItems,
    };

    await client.post<MerchizeApiResponse<MerchizeCreateOrderResponseData>>('/order/external/orders', body);

    // A fresh Merchize store defaults to Auto Fulfillment: OFF — an imported
    // order sits un-fulfilled until pushed. Push explicitly so fulfillment
    // always starts regardless of that account-level setting. Failure here is
    // logged, not thrown — the order was still successfully created and the
    // seller can push manually from their dashboard if this fails.
    const pushBody: MerchizeOrderRefRequest = { order: { external_number: referenceId } };
    await client.post('/order/external/orders/push', pushBody).catch((err: Error) =>
      this.logger.warn(`Failed to push Merchize order ${referenceId} into production: ${err.message}`),
    );

    return { externalOrderId: referenceId, status: 'submitted' };
  }

  async getOrderStatus(conn: DecryptedConnection, externalOrderId: string): Promise<{ status: string }> {
    const { data } = await this.client(conn.externalShopId, conn.apiKey).get<MerchizeApiResponse<MerchizeOrderProgressData>>(
      '/order/external/orders/order-progress',
      { params: { external_number: externalOrderId } },
    );
    const done = [...data.data.order_progress].reverse().find((p) => p.status === 'done');
    return { status: done?.event ?? 'pending' };
  }

  async cancelOrder(conn: DecryptedConnection, externalOrderId: string): Promise<void> {
    const body: MerchizeOrderRefRequest = { order: { external_number: externalOrderId } };
    await this.client(conn.externalShopId, conn.apiKey).post('/order/external/orders/cancel', body);
  }

  async getShippingRateCents(
    conn: DecryptedConnection,
    items: FulfillmentLineItem[],
    addressTo: FulfillmentAddress,
  ): Promise<number> {
    const client = this.client(conn.externalShopId, conn.apiKey);
    const parentSkus = [...new Set(items.map((i) => i.externalProductId))];

    const { data } = await client.get<MerchizeApiResponse<MerchizeCatalogResponseData>>('/product/catalog', {
      params: { search: parentSkus.join(',') },
    });

    let totalCents = 0;
    for (const item of items) {
      const product = data.data.products.find((p) => p.sku === item.externalProductId);
      const variant  = product?.variants.find((v) => v.sku === item.externalVariantId);
      if (!variant) {
        throw new Error(`No Merchize catalog data for variant "${item.externalVariantId}" — cannot compute shipping rate`);
      }

      const price = this.resolveShippingPrice(variant.shipping_prices, addressTo.country);
      if (!price) {
        throw new Error(`No shipping price found for variant "${item.externalVariantId}" to country "${addressTo.country}"`);
      }

      const units = Math.max(0, item.quantity - 1);
      totalCents += Math.round((price.first_item + units * price.additional_item) * 100);
    }

    return totalCents;
  }

  /** Exact country match first, then that country's zone-wide fallback (`to_country: "all"`), then ROW (rest of world) as the ultimate catch-all. */
  private resolveShippingPrice(prices: MerchizeCatalogShippingPrice[], country: string): MerchizeCatalogShippingPrice | undefined {
    const target = country.toUpperCase();

    const exact = prices.find(
      (p) => p.to_country !== 'all' && p.to_country.split(',').map((c) => c.trim().toUpperCase()).includes(target),
    );
    if (exact) return exact;

    const zoneAll = prices.find((p) => p.to_zone.toUpperCase() === target && p.to_country === 'all');
    if (zoneAll) return zoneAll;

    return prices.find((p) => p.to_zone.toUpperCase() === 'ROW' && p.to_country === 'all');
  }

  async registerWebhooks(): Promise<WebhookRegistration> {
    // No webhook-registration API exists — the seller configures this
    // manually in their Merchize dashboard (Settings → Webhook), pointing it
    // at the callback URL we surface after connecting.
    return { externalWebhookIds: [] };
  }

  async unregisterWebhooks(): Promise<void> {
    // Nothing to unregister via API — see registerWebhooks above.
  }

  parseWebhookPayload(rawBody: Buffer): ParsedWebhookEvent {
    const payload = JSON.parse(rawBody.toString('utf8')) as MerchizeWebhookEnvelope<MerchizeCorrelatableResource>;
    return {
      externalOrderId: payload.resource.external_number,
      eventType:        payload.event_type,
      raw:              payload,
    };
  }
}
