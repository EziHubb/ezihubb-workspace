import { Injectable, Logger } from '@nestjs/common';
import { FulfillmentStatus, TrackingStage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderTrackingService } from '../order-tracking/order-tracking.service';
import { PrintifyOrderShipmentData, PrintifyOrderUpdatedData, PrintifyWebhookEvent } from './printify/printify.types';

// Printify's `status` strings are free text (no enum in their spec) — known
// real-world values mapped below; anything unrecognized is logged and the
// StoreOrderFulfillment row's status is left unchanged rather than guessed.
const ORDER_UPDATED_STATUS_MAP: Record<string, FulfillmentStatus> = {
  'pending':               FulfillmentStatus.SUBMITTED,
  'on-hold':               FulfillmentStatus.SUBMITTED,
  'sending-to-production': FulfillmentStatus.SUBMITTED,
  'in-production':         FulfillmentStatus.IN_PRODUCTION,
  'fulfilled':             FulfillmentStatus.FULFILLED,
  'partially-fulfilled':   FulfillmentStatus.FULFILLED,
  'canceled':              FulfillmentStatus.FAILED,
};

const TRACKING_STAGE_MAP: Record<string, TrackingStage> = {
  'order:sent-to-production':   TrackingStage.SENT_TO_FULFILLMENT,
  'order:updated':              TrackingStage.IN_PRODUCTION,
  'order:shipment:created':     TrackingStage.IN_TRANSIT,
  'order:shipment:delivered':   TrackingStage.DELIVERED,
};

@Injectable()
export class FulfillmentWebhookService {
  private readonly logger = new Logger(FulfillmentWebhookService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly tracking: OrderTrackingService,
  ) {}

  async handlePrintifyEvent(connectionId: string, rawBody: Buffer): Promise<void> {
    const event = JSON.parse(rawBody.toString('utf8')) as PrintifyWebhookEvent;
    const externalOrderId = event.resource?.id;
    if (!externalOrderId) {
      this.logger.warn(`Printify webhook missing resource.id — type=${event.type}`);
      return;
    }

    const fulfillment = await this.prisma.storeOrderFulfillment.findUnique({
      where:   { connectionId_externalOrderId: { connectionId, externalOrderId } },
      include: { storeOrder: { select: { id: true, orderId: true } } },
    });
    if (!fulfillment) {
      // Not necessarily an error — e.g. a stale webhook from a disconnected/reconnected shop.
      this.logger.debug(`No StoreOrderFulfillment for connection=${connectionId} externalOrderId=${externalOrderId} — ignoring`);
      return;
    }

    const status = this.resolveStatus(event);
    let carrierCode: string | undefined;
    let trackingNumber: string | undefined;
    let trackingUrl: string | undefined;

    if (event.type === 'order:shipment:created' || event.type === 'order:shipment:delivered') {
      const data = event.resource.data as unknown as PrintifyOrderShipmentData;
      carrierCode    = data.carrier?.code;
      trackingNumber = data.carrier?.tracking_number;
      trackingUrl    = data.carrier?.tracking_url;
    }

    if (status) {
      await this.prisma.storeOrderFulfillment.update({
        where: { id: fulfillment.id },
        data:  { status },
      });
    }

    if (trackingNumber) {
      await this.prisma.storeOrder.update({
        where: { id: fulfillment.storeOrder.id },
        data:  { trackingNumber, trackingUrl, carrier: carrierCode },
      });
    }

    const stage = TRACKING_STAGE_MAP[event.type];
    if (stage) {
      await this.tracking.updateStage(
        fulfillment.storeOrder.orderId,
        stage,
        `Printify: ${event.type}`,
        'printify',
        carrierCode,
        trackingNumber,
      );
    }
  }

  private resolveStatus(event: PrintifyWebhookEvent): FulfillmentStatus | undefined {
    switch (event.type) {
      case 'order:sent-to-production':
        return FulfillmentStatus.IN_PRODUCTION;
      case 'order:shipment:created':
      case 'order:shipment:delivered':
        return FulfillmentStatus.FULFILLED;
      case 'order:updated': {
        const data = event.resource.data as unknown as PrintifyOrderUpdatedData;
        const mapped = ORDER_UPDATED_STATUS_MAP[data.status];
        if (!mapped) this.logger.warn(`Unrecognized Printify order status: "${data.status}"`);
        return mapped;
      }
      default:
        this.logger.debug(`Unhandled Printify webhook type: ${event.type}`);
        return undefined;
    }
  }
}
