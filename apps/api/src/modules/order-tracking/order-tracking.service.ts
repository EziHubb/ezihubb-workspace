import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingStage } from '@prisma/client';

@Injectable()
export class OrderTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  async getTracking(orderId: string) {
    const tracking = await this.prisma.orderTracking.findUnique({
      where: { orderId },
      include: { events: { orderBy: { eventAt: 'desc' } } },
    });
    if (!tracking) {
      // Auto-create a basic tracking record if the order exists
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      return this.prisma.orderTracking.create({
        data: { orderId, currentStage: TrackingStage.ORDER_CONFIRMED },
        include: { events: true },
      });
    }
    return tracking;
  }

  async updateStage(
    orderId: string,
    stage: TrackingStage,
    title: string,
    source: string,
    carrierName?: string,
    carrierTrackingNumber?: string,
  ): Promise<void> {
    // Upsert the tracking record first so the relation exists for the event
    await this.prisma.orderTracking.upsert({
      where: { orderId },
      create: {
        orderId,
        currentStage: stage,
        ...(carrierName && { carrierName }),
        ...(carrierTrackingNumber && { carrierTrackingNumber }),
      },
      update: {
        currentStage: stage,
        ...(carrierName && { carrierName }),
        ...(carrierTrackingNumber && { carrierTrackingNumber }),
        lastPolledAt: new Date(),
      },
    });

    // Now that the tracking record exists, create the event
    const tracking = await this.prisma.orderTracking.findUniqueOrThrow({ where: { orderId } });
    await this.prisma.trackingEvent.create({
      data: {
        trackingId: tracking.id,
        stage,
        title,
        source,
        eventAt: new Date(),
      },
    });
  }

  async handlePrintifyWebhook(payload: any): Promise<void> {
    // Map Printify statuses to our TrackingStage
    const statusMap: Record<string, TrackingStage> = {
      in_production: TrackingStage.IN_PRODUCTION,
      fulfilled:     TrackingStage.IN_TRANSIT,
      sent_to_production: TrackingStage.SENT_TO_FULFILLMENT,
    };

    const externalOrderId = payload?.data?.order?.external_id as string | undefined;
    if (!externalOrderId) return;

    const stage = statusMap[payload?.type as string] ?? TrackingStage.SENT_TO_FULFILLMENT;
    const title = `Printify: ${payload?.type ?? 'update'}`;

    await this.updateStage(
      externalOrderId,
      stage,
      title,
      'printify',
      payload?.data?.order?.carrier as string | undefined,
      payload?.data?.order?.tracking_number as string | undefined,
    );
  }
}
