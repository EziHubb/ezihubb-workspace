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
import { createHmac } from 'node:crypto';
import { Request } from 'express';
import { OrderProgressStepKind, OrderStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TrackingService } from './tracking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ensureFixedOrderProgressSteps } from '../orders/order-progress.defaults';
import { syncOrderStatusFromShops } from '../orders/order-status-sync';

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
      this.logger.warn('EASYPOST_WEBHOOK_SECRET not set — webhook signature verification disabled');
    }
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'EasyPost carrier tracking webhook — auto-updates order status' })
  async handleWebhook(@Req() req: Request & { rawBody?: Buffer }) {
    const body = req.body as unknown;
    const signature = req.headers['x-hmac-signature'] as string | undefined;

    if (this.webhookSecret) {
      if (!signature) {
        throw new UnauthorizedException('Missing X-Hmac-Signature header');
      }
      // Use raw body for HMAC verification when available (most accurate)
      const payload = req.rawBody ?? Buffer.from(JSON.stringify(body));
      const expected = createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');
      if (signature !== expected) {
        throw new UnauthorizedException('Invalid EasyPost webhook signature');
      }
    }

    const event = this.trackingService.parseWebhookEvent(body);
    if (!event) return { received: true };

    // Try trackerId first (most precise), then trackingNumber as fallback
    const orConditions = [
      ...(event.trackerId   ? [{ trackerId: event.trackerId }]           : []),
      ...(event.trackingCode ? [{ trackingNumber: event.trackingCode }] : []),
    ];
    if (!orConditions.length) return { received: true };

    const order = await this.prisma.order.findFirst({
      where: { OR: orConditions },
      include: {
        user:  { select: { email: true, firstName: true } },
        items: { select: { productName: true } },
      },
    });

    if (!order) {
      this.logger.debug(
        `EasyPost webhook: no order found for trackerId=${event.trackerId} trackingCode=${event.trackingCode}`,
      );
      return { received: true };
    }

    if (event.status === 'delivered' && order.status !== OrderStatus.DELIVERED) {
      const now = new Date();
      const becameDelivered = await this.prisma.$transaction(async (tx) => {
        const matchingRows = await tx.storeOrder.findMany({
          where: {
            orderId: order.id,
            ...(event.trackingCode ? { trackingNumber: event.trackingCode } : {}),
          },
          select: { id: true, storeId: true },
        });
        const targetRows = matchingRows.length
          ? matchingRows
          : await tx.storeOrder.findMany({
              where:  { orderId: order.id, status: OrderStatus.SHIPPED },
              select: { id: true, storeId: true },
            });

        for (const storeId of [...new Set(targetRows.map((row) => row.storeId))]) {
          const steps = await ensureFixedOrderProgressSteps(tx, storeId);
          const deliveredStep = steps.find((step) => step.kind === OrderProgressStepKind.DELIVERED);
          await tx.storeOrder.updateMany({
            where: { id: { in: targetRows.filter((row) => row.storeId === storeId).map((row) => row.id) } },
            data: {
              status:         OrderStatus.DELIVERED,
              progressStepId: deliveredStep?.id,
              deliveredAt:    now,
            },
          });
        }

        if (targetRows.length) {
          await syncOrderStatusFromShops(tx, [order.id]);
        } else {
          // Legacy order without StoreOrder rows: retain the old behaviour.
          await tx.order.update({
            where: { id: order.id },
            data:  { status: OrderStatus.DELIVERED },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status:  OrderStatus.DELIVERED,
              note:    'Auto-updated from EasyPost tracking webhook',
            },
          });
        }

        const finalOrder = await tx.order.findUnique({
          where:  { id: order.id },
          select: { status: true },
        });
        if (finalOrder?.status === OrderStatus.DELIVERED) {
          await tx.order.update({ where: { id: order.id }, data: { deliveredAt: now } });
          return true;
        }
        return false;
      });

      const email = order.guestEmail ?? order.user?.email;
      if (becameDelivered && email) {
        await this.notificationsService.sendOrderDelivered({
          email,
          orderNumber: order.orderNumber,
          orderId:     order.id,
          firstName:   order.user?.firstName ?? undefined,
          items:       order.items.map((i) => ({ productName: i.productName, productSlug: '' })),
        });
      }

      this.logger.log(
        becameDelivered
          ? `Order ${order.orderNumber} auto-updated to DELIVERED via EasyPost`
          : `Order ${order.orderNumber} has a delivered shop part; waiting for remaining shops`,
      );
    } else {
      this.logger.debug(
        `EasyPost webhook: order=${order.orderNumber} status=${event.status} (no action taken)`,
      );
    }

    return { received: true };
  }
}
