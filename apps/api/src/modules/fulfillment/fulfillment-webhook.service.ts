import { Injectable, Logger } from '@nestjs/common';
import { FulfillmentStatus, TrackingStage } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderTrackingService } from '../order-tracking/order-tracking.service';
import { PrintifyOrderShipmentData, PrintifyOrderUpdatedData, PrintifyWebhookEvent } from './printify/printify.types';
import {
  MerchizeCorrelatableResource,
  MerchizeImporterErrorResource,
  MerchizeInvalidAddressResource,
  MerchizeProgressResource,
  MerchizeShipmentResource,
  MerchizeTrackingResource,
  MerchizeWebhookEnvelope,
} from './merchize/merchize.types';

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

// Merchize's `order_progress[].event` vocabulary, confirmed from real
// ORDER.CHANGED.PROGRESS webhook payloads (see docs/merchize-api.md).
// `buyer_paid`/`fulfillment_cost_paid` are billing milestones with no
// fulfillment-status equivalent, so they're intentionally left unmapped.
const MERCHIZE_PROGRESS_MAP: Record<string, { status?: FulfillmentStatus; stage?: TrackingStage }> = {
  pushed_order:     { status: FulfillmentStatus.SUBMITTED,    stage: TrackingStage.SENT_TO_FULFILLMENT },
  in_production:    { status: FulfillmentStatus.IN_PRODUCTION, stage: TrackingStage.IN_PRODUCTION },
  shipment_started: { status: FulfillmentStatus.FULFILLED,    stage: TrackingStage.IN_TRANSIT },
  in_transit:       { stage: TrackingStage.IN_TRANSIT },
  delivered:        { status: FulfillmentStatus.FULFILLED,    stage: TrackingStage.DELIVERED },
};

// Merchize's `resource.new_shipment_status` vocabulary confirmed from a real
// ORDER.CHANGED.SHIPMENT webhook payload example (pre_transit → in_transit).
const MERCHIZE_SHIPMENT_STAGE_MAP: Record<string, TrackingStage> = {
  pre_transit: TrackingStage.PICKED_UP,
  in_transit:  TrackingStage.IN_TRANSIT,
  delivered:   TrackingStage.DELIVERED,
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

  async handleMerchizeEvent(connectionId: string, rawBody: Buffer): Promise<void> {
    const event = JSON.parse(rawBody.toString('utf8')) as MerchizeWebhookEnvelope<MerchizeCorrelatableResource>;
    const externalOrderId = event.resource?.external_number;
    if (!externalOrderId) {
      this.logger.warn(`Merchize webhook missing resource.external_number — type=${event.event_type}`);
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

    switch (event.event_type) {
      case 'ORDER.CHANGED.TRACKING': {
        const resource = event.resource as unknown as MerchizeTrackingResource;
        if (resource.tracking_number) {
          await this.prisma.storeOrder.update({
            where: { id: fulfillment.storeOrder.id },
            data:  { trackingNumber: resource.tracking_number, trackingUrl: resource.tracking_url, carrier: resource.tracking_company },
          });
        }
        await this.prisma.storeOrderFulfillment.update({
          where: { id: fulfillment.id },
          data:  { status: FulfillmentStatus.FULFILLED },
        });
        await this.tracking.updateStage(
          fulfillment.storeOrder.orderId,
          TrackingStage.IN_TRANSIT,
          `Merchize: ${event.event_type}`,
          'merchize',
          resource.tracking_company,
          resource.tracking_number,
        );
        break;
      }

      case 'ORDER.CHANGED.SHIPMENT': {
        const resource = event.resource as unknown as MerchizeShipmentResource;
        const stage = resource.new_shipment_status ? MERCHIZE_SHIPMENT_STAGE_MAP[resource.new_shipment_status] : undefined;
        if (stage) {
          await this.tracking.updateStage(fulfillment.storeOrder.orderId, stage, `Merchize: ${resource.new_shipment_status}`, 'merchize');
        } else {
          this.logger.warn(`Unrecognized Merchize shipment status: "${resource.new_shipment_status}"`);
        }
        break;
      }

      case 'ORDER.CHANGED.PROGRESS': {
        const resource = event.resource as unknown as MerchizeProgressResource;
        const latestDone = [...(resource.order_progress ?? [])].reverse().find((p) => p.status === 'done');
        const mapped = latestDone ? MERCHIZE_PROGRESS_MAP[latestDone.event] : undefined;
        if (latestDone && !mapped) {
          this.logger.warn(`Unrecognized Merchize progress event: "${latestDone.event}"`);
        }
        if (mapped?.status) {
          await this.prisma.storeOrderFulfillment.update({ where: { id: fulfillment.id }, data: { status: mapped.status } });
        }
        if (mapped?.stage) {
          await this.tracking.updateStage(fulfillment.storeOrder.orderId, mapped.stage, `Merchize: ${latestDone!.event}`, 'merchize');
        }
        break;
      }

      case 'ORDER.INVALID.ADDRESS': {
        const resource = event.resource as unknown as MerchizeInvalidAddressResource;
        await this.prisma.storeOrderFulfillment.update({
          where: { id: fulfillment.id },
          data:  { status: FulfillmentStatus.FAILED, errorMessage: `Invalid address (${resource.type_invalid}): ${resource.message_invalid}` },
        });
        break;
      }

      case 'ORDER.IMPORTER.ERROR': {
        const resource = event.resource as unknown as MerchizeImporterErrorResource;
        await this.prisma.storeOrderFulfillment.update({
          where: { id: fulfillment.id },
          data:  { status: FulfillmentStatus.FAILED, errorMessage: resource.error },
        });
        break;
      }

      default:
        // Billing (ORDER.PAYMENT.*), ticketing (ORDER.ISSUE.UPDATED), ORDER.CREATED,
        // and ORDER.CHANGED.PROGRESS_STATUS are out of scope — see docs/merchize-api.md.
        this.logger.debug(`Unhandled Merchize webhook type: ${event.event_type}`);
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
