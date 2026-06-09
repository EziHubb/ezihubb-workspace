import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { NotificationsService, EmailTemplate } from '../notifications/notifications.service';

const DEDUP_TTL = 24 * 60 * 60; // 24 hours

type ProductStockInfo = {
  id:                string;
  name:              string;
  sku:               string | null;
  slug:              string;
  quantity:          number | null;
  lowStockThreshold: number | null;
};

@Injectable()
export class LowStockService {
  private readonly logger = new Logger(LowStockService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly redis:         RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Called after an order is confirmed — decrements tracked inventory and
   * fires alerts for any product that drops at or below its threshold.
   */
  async checkAfterOrder(orderId: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where:  { id: orderId },
      select: {
        id:    true,
        items: {
          select: {
            quantity: true,
            product: {
              select: {
                id:                true,
                name:              true,
                sku:               true,
                slug:              true,
                trackInventory:    true,
                lowStockThreshold: true,
                quantity:          true,
              },
            },
          },
        },
      },
    });

    if (!order) return;

    const processed = new Set<string>();

    for (const item of order.items) {
      const { product } = item;
      if (!product.trackInventory || product.quantity === null) continue;
      if (processed.has(product.id)) continue;
      processed.add(product.id);

      const updated = await this.prisma.product.update({
        where: { id: product.id },
        data:  { quantity: { decrement: item.quantity } },
        select: {
          id:                true,
          name:              true,
          sku:               true,
          slug:              true,
          quantity:          true,
          lowStockThreshold: true,
        },
      });

      if (updated.quantity === null) continue;

      const isOutOfStock = updated.quantity <= 0;
      const isLowStock   = !isOutOfStock
        && updated.lowStockThreshold !== null
        && updated.quantity <= updated.lowStockThreshold;

      if (isOutOfStock || isLowStock) {
        await this.maybeAlert(updated, isOutOfStock ? 'out-of-stock' : 'low-stock');
      }
    }
  }

  /**
   * Daily background scan — alerts for every tracked product at/below threshold.
   * Dedup prevents repeat alerts within 24 hours.
   */
  async dailyScan(): Promise<void> {
    const products = await this.prisma.product.findMany({
      where: {
        trackInventory: true,
        isActive:       true,
        quantity:       { not: null },
      },
      select: {
        id:                true,
        name:              true,
        sku:               true,
        slug:              true,
        quantity:          true,
        lowStockThreshold: true,
      },
    });

    let alerted = 0;
    for (const product of products) {
      if (product.quantity === null) continue;

      const isOutOfStock = product.quantity <= 0;
      const isLowStock   = !isOutOfStock
        && product.lowStockThreshold !== null
        && product.quantity <= product.lowStockThreshold;

      if (isOutOfStock || isLowStock) {
        const sent = await this.maybeAlert(product, isOutOfStock ? 'out-of-stock' : 'low-stock');
        if (sent) alerted++;
      }
    }

    this.logger.log(`Daily low-stock scan complete: ${alerted} alert(s) sent`);
  }

  private async maybeAlert(
    product: ProductStockInfo,
    type:    'low-stock' | 'out-of-stock',
  ): Promise<boolean> {
    const dedupKey   = `low_stock_alert:${product.id}`;
    const alreadySent = await this.redis.exists(dedupKey);
    if (alreadySent) return false;

    await this.redis.set(dedupKey, '1', DEDUP_TTL);

    const adminEmail  = process.env['ADMIN_EMAIL'] ?? 'admin@mapleloomhandmade.com';
    const adminUrl    = process.env['ADMIN_URL']   ?? 'http://localhost:3001';
    const qty         = product.quantity ?? 0;
    const subject     = type === 'out-of-stock'
      ? `Out of stock: ${product.name}`
      : `Low stock alert: ${product.name} (${qty} remaining)`;

    await this.notifications.queueEmail({
      to:       adminEmail,
      subject,
      template: EmailTemplate.LOW_STOCK_ALERT,
      data: {
        productName:     product.name,
        sku:             product.sku ?? 'N/A',
        quantity:        qty,
        threshold:       product.lowStockThreshold ?? 0,
        status:          type === 'out-of-stock' ? 'Out of Stock' : 'Low Stock',
        isOutOfStock:    type === 'out-of-stock',
        adminProductUrl: `${adminUrl}/products/${product.id}/edit`,
        year:            new Date().getFullYear(),
      },
    });

    this.logger.warn(
      `[LowStock] Alert sent: "${product.name}" qty=${qty} threshold=${product.lowStockThreshold ?? 'none'} type=${type}`,
    );
    return true;
  }
}
