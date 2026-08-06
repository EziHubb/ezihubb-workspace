import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  PrintifyAddressTo,
  PrintifyOrder,
  PrintifyOrderCreatedResponse,
  PrintifyPaginatedResponse,
  PrintifyProduct,
  PrintifyShippingCosts,
  PrintifyShop,
  PrintifySubmitOrderRequest,
  PrintifyWebhook,
  PrintifyWebhookEvent,
} from './printify.types';

/**
 * Printify implementation of FulfillmentProvider. Every request shape below
 * was verified directly against https://developers.printify.com/openapi.json
 * — not guessed. Notably: Printify's webhook API has no signature/secret
 * mechanism (see fulfillment-webhook.controller.ts for how that's handled),
 * and listShopProducts() only reads products the seller already published in
 * their own Printify shop — it does not create/publish new ones.
 */
@Injectable()
export class PrintifyProvider implements FulfillmentProvider {
  readonly type = FulfillmentProviderType.PRINTIFY;

  private readonly logger  = new Logger(PrintifyProvider.name);
  private readonly baseUrl = 'https://api.printify.com/v1';
  private readonly timeout = 10_000;

  // Topics we subscribe to for every connection — see printify.types.ts for payload shapes.
  private readonly webhookTopics = [
    'order:updated',
    'order:sent-to-production',
    'order:shipment:created',
    'order:shipment:delivered',
  ];

  private client(apiKey: string) {
    return axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }

  async verifyConnection(apiKey: string, externalShopId: string): Promise<{ shopName: string }> {
    const { data: shops } = await this.client(apiKey).get<PrintifyShop[]>('/shops.json');
    const shop = shops.find((s) => String(s.id) === externalShopId);
    if (!shop) {
      throw new BadRequestException('This API key does not have access to the given Printify shop id');
    }
    return { shopName: shop.title };
  }

  async listShopProducts(conn: DecryptedConnection): Promise<ShopProductSummary[]> {
    const { data } = await this.client(conn.apiKey).get<PrintifyPaginatedResponse<PrintifyProduct>>(
      `/shops/${conn.externalShopId}/products.json`,
    );
    return data.data.map((p) => ({
      externalProductId: p.id,
      title:              p.title,
      thumbnailUrl:       p.images?.find((i) => i.is_default)?.src ?? p.images?.[0]?.src,
      variants:           p.variants.map((v) => ({ externalVariantId: String(v.id), title: v.title })),
    }));
  }

  async createOrder(
    conn: DecryptedConnection,
    referenceId: string,
    items: FulfillmentLineItem[],
    shipTo: FulfillmentAddress,
  ) {
    const body: PrintifySubmitOrderRequest = {
      external_id: referenceId,
      line_items:  items.map((i) => ({
        product_id: i.externalProductId,
        variant_id: Number(i.externalVariantId),
        quantity:   i.quantity,
      })),
      address_to: this.toPrintifyAddress(shipTo),
    };

    const { data } = await this.client(conn.apiKey).post<PrintifyOrderCreatedResponse>(
      `/shops/${conn.externalShopId}/orders.json`,
      body,
    );
    return { externalOrderId: data.id, status: 'submitted' };
  }

  async getOrderStatus(conn: DecryptedConnection, externalOrderId: string) {
    const { data } = await this.client(conn.apiKey).get<PrintifyOrder>(
      `/shops/${conn.externalShopId}/orders/${externalOrderId}.json`,
    );
    return { status: data.status };
  }

  async cancelOrder(conn: DecryptedConnection, externalOrderId: string): Promise<void> {
    await this.client(conn.apiKey).post(
      `/shops/${conn.externalShopId}/orders/${externalOrderId}/cancel.json`,
    );
  }

  async getShippingRateCents(
    conn: DecryptedConnection,
    items: FulfillmentLineItem[],
    addressTo: FulfillmentAddress,
  ): Promise<number> {
    const { data } = await this.client(conn.apiKey).post<PrintifyShippingCosts>(
      `/shops/${conn.externalShopId}/orders/shipping.json`,
      {
        line_items: items.map((i) => ({
          product_id: i.externalProductId,
          variant_id: Number(i.externalVariantId),
          quantity:   i.quantity,
        })),
        address_to: this.toPrintifyAddress(addressTo),
      },
    );
    // `standard` is the default/cheapest option we surface to the buyer for phase 1.
    return data.standard ?? 0;
  }

  async registerWebhooks(conn: DecryptedConnection, callbackUrl: string): Promise<WebhookRegistration> {
    const client = this.client(conn.apiKey);
    const externalWebhookIds: string[] = [];
    for (const topic of this.webhookTopics) {
      const { data } = await client.post<PrintifyWebhook>(
        `/shops/${conn.externalShopId}/webhooks.json`,
        { topic, url: callbackUrl },
      );
      externalWebhookIds.push(data.id);
    }
    return { externalWebhookIds };
  }

  async unregisterWebhooks(conn: DecryptedConnection, externalWebhookIds: string[]): Promise<void> {
    const client = this.client(conn.apiKey);
    for (const id of externalWebhookIds) {
      await client.delete(`/shops/${conn.externalShopId}/webhooks/${id}.json`).catch((err: Error) =>
        this.logger.warn(`Failed to unregister Printify webhook ${id}: ${err.message}`),
      );
    }
  }

  parseWebhookPayload(rawBody: Buffer): ParsedWebhookEvent {
    const payload = JSON.parse(rawBody.toString('utf8')) as PrintifyWebhookEvent;
    return {
      externalOrderId: payload.resource.id,
      eventType:        payload.type,
      raw:              payload,
    };
  }

  private toPrintifyAddress(addr: FulfillmentAddress): PrintifyAddressTo {
    const [firstName, ...rest] = addr.fullName.trim().split(' ');
    return {
      first_name: firstName || addr.fullName,
      last_name:  rest.join(' ') || '-',
      phone:      addr.phone,
      country:    addr.country,
      region:     addr.state,
      address1:   addr.addressLine1,
      address2:   addr.addressLine2,
      city:       addr.city,
      zip:        addr.postalCode,
    };
  }
}
