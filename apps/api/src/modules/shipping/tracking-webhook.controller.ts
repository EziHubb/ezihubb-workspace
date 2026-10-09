import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { OrderProgressStepKind, OrderStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingService } from './tracking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ensureFixedOrderProgressSteps } from '../orders/order-progress.defaults';
import { syncOrderStatusFromShops } from '../orders/order-status-sync';
import { assertEconomicShopFulfillmentAllowed } from '../finances/economic-fulfillment-guard';

const RECEIVABLE_PARENT_STATES: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.IN_PRODUCTION, OrderStatus.SHIPPED];

@ApiTags('Webhooks')
@SkipThrottle()
@Controller('webhooks/easypost')
export class TrackingWebhookController {
  private readonly logger = new Logger(TrackingWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly trackingService: TrackingService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('EASYPOST_WEBHOOK_SECRET', '');
    if (!this.webhookSecret) {
      this.logger.warn('EASYPOST_WEBHOOK_SECRET not set — tracking webhooks will be rejected');
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'EasyPost carrier tracking webhook — auto-updates order status' })
  async handleWebhook(@Req() req: Request & { rawBody?: Buffer }) {
    const header = req.headers['x-hmac-signature'];
    // EasyPost v1 sends the algorithm prefix. Accept the previously supported
    // bare digest as well; both must verify against the exact raw body.
    const signature = typeof header === 'string' ? header.replace(/^hmac-sha256-hex=/, '') : undefined;

    if (!this.webhookSecret || !req.rawBody) {
      throw new UnauthorizedException('Webhook verification unavailable');
    }
    {
      if (!signature) {
        throw new UnauthorizedException('Missing X-Hmac-Signature header');
      }
      // Use raw body for HMAC verification when available (most accurate)
      const payload = req.rawBody;
      const expected = createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');
      if (!/^[a-fA-F0-9]{64}$/.test(signature) ||
          !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
        throw new UnauthorizedException('Invalid EasyPost webhook signature');
      }
    }

    // Process the same bytes that were authenticated, not an independently
    // populated request.body. Malformed signed JSON cannot authorize a write.
    let body: unknown;
    try { body = JSON.parse(req.rawBody.toString('utf8')); }
    catch { return { received: true }; }
    const event = this.trackingService.parseWebhookEvent(body);
    if (!event) return { received: true };

    if (event.status !== 'delivered' || (!event.trackerId && !event.trackingCode)) return { received: true };
    const eventId = body && typeof body === 'object' && 'id' in body ? body.id : undefined;
    const eventHash = createHash('sha256').update('easypost:delivery:')
      .update(typeof eventId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(eventId) ? eventId : req.rawBody).digest('hex');
    const include = {
      user: { select: { email: true, firstName: true } },
      items: { select: { productName: true } },
    } as const;
    let matches = event.trackerId ? await this.prisma.order.findMany({
      where: { trackerId: event.trackerId }, include, take: 2,
    }) : [];
    // Never apply a tracking-number fallback to a different registered tracker,
    // or arbitrarily pick one of multiple orders sharing that number.
    if (!matches.length && event.trackingCode) matches = await this.prisma.order.findMany({
      where: {
        trackingNumber: event.trackingCode,
        OR: [{ trackerId: null }, { trackerId: event.trackerId }],
      }, include, take: 2,
    });
    if (matches.length !== 1) return { received: true };
    const order = matches[0];

    if (order.adminArchivedAt || !RECEIVABLE_PARENT_STATES.includes(order.status)) {
      return { received: true };
    }

    const now = new Date();
    const becameDelivered = await this.prisma.$transaction(async (tx) => {
      // Same lock ordering as economic cancellation/refund/fulfillment paths.
      const context = await tx.economicOrderContext.findUnique({ where: { orderId: order.id } });
      if (context) await tx.$queryRaw`SELECT "id" FROM "EconomicOrderContext" WHERE "id" = ${context.id} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${order.id} FOR UPDATE`;
      const current = await tx.order.findUnique({ where: { id: order.id }, select: { status: true, adminArchivedAt: true, trackingNumber: true } });
      if (!current || current.adminArchivedAt || !RECEIVABLE_PARENT_STATES.includes(current.status)) return false;

      const shops = await tx.storeOrder.findMany({
        where: { orderId: order.id },
        select: { id: true, storeId: true, status: true, trackingNumber: true },
      });
      const targets = shops.filter(row => row.status === OrderStatus.SHIPPED && (
        event.trackingCode ? row.trackingNumber === event.trackingCode : shops.length === 1
      ));
      // No guessed shipment: a mismatching number must not deliver other shops,
      // and terminal shop rows must not fall through to the legacy order path.
      if (shops.length && !targets.length) return false;
      if (!shops.length && current.status !== OrderStatus.SHIPPED) return false;
      if (!shops.length && event.trackingCode && current.trackingNumber !== event.trackingCode) return false;
      await assertEconomicShopFulfillmentAllowed(tx, order.id, targets.map(row => row.id));
      const claim = await tx.trackingDeliveryReceipt.createMany({
        data: [{ eventHash, orderId: order.id }], skipDuplicates: true,
      });
      if (!claim.count) return false;

      let changed = 0;
      for (const storeId of [...new Set(targets.map(row => row.storeId))]) {
        const steps = await ensureFixedOrderProgressSteps(tx, storeId);
        const deliveredStep = steps.find(step => step.kind === OrderProgressStepKind.DELIVERED);
        const result = await tx.storeOrder.updateMany({
          where: { id: { in: targets.filter(row => row.storeId === storeId).map(row => row.id) }, status: OrderStatus.SHIPPED },
          data: { status: OrderStatus.DELIVERED, progressStepId: deliveredStep?.id, deliveredAt: now },
        });
        changed += result.count;
      }
      if (shops.length) {
        if (!changed) return false;
        await syncOrderStatusFromShops(tx, [order.id]);
      } else {
        const result = await tx.order.updateMany({
          where: { id: order.id, status: OrderStatus.SHIPPED, adminArchivedAt: null },
          data: { status: OrderStatus.DELIVERED, deliveredAt: now },
        });
        if (!result.count) return false;
        await tx.orderStatusHistory.create({ data: {
          orderId: order.id, status: OrderStatus.DELIVERED,
          note: 'Auto-updated from authenticated EasyPost tracking webhook',
        } });
      }
      const delivered = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.DELIVERED, deliveredAt: null, adminArchivedAt: null },
        data: { deliveredAt: now },
      });
      // For legacy rows the transition above already claimed delivery. Shop
      // replay/concurrent requests can only claim the parent notification once.
      return shops.length ? delivered.count === 1 : true;
    }, { isolationLevel: 'Serializable' });

    const email = order.guestEmail ?? order.user?.email;
    if (becameDelivered && email) {
      await this.notificationsService.sendOrderDelivered({
        email, orderNumber: order.orderNumber, orderId: order.id,
        firstName: order.user?.firstName ?? undefined,
        items: order.items.map(i => ({ productName: i.productName, productSlug: '' })),
      });
    }

    return { received: true };
  }
}
