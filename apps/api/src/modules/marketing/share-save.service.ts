import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SHARE_SAVE_REFUND_RATE } from './marketing.constants';

const SHOP_URL = process.env['CLIENT_URL'] ?? 'https://ezihubb.com';

@Injectable()
export class ShareSaveService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { slug: true, shareSaveEnabled: true, shareSaveJoinedAt: true },
    });
    if (!store) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Store not found' });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [clicks, conversions, refundAgg] = await Promise.all([
      this.prisma.storeLinkClick.count({
        where: { storeId, kind: 'SHARE_SAVE', createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.storeLinkClick.count({
        where: { storeId, kind: 'SHARE_SAVE', convertedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.sellerLedgerEntry.aggregate({
        where: { storeId, type: 'SHARE_SAVE_REFUND', createdAt: { gte: thirtyDaysAgo } },
        _sum: { amount: true },
      }),
    ]);

    return {
      enabled:      store.shareSaveEnabled,
      joinedAt:     store.shareSaveJoinedAt,
      // No single "the" link — each buyer gets their own personalized
      // `?ss=<their user id>` link from the Share & Save widget on your shop
      // page, so the reward always credits whoever actually shared it.
      shopUrl:      `${SHOP_URL}/shops/${store.slug}`,
      refundRate:   SHARE_SAVE_REFUND_RATE,
      stats: {
        clicks30d:      clicks,
        conversions30d: conversions,
        // Ledger entries are negative (seller-funded, like every other
        // discount) — display the credit as a positive magnitude.
        refunded30d:    Math.abs(Number(refundAgg._sum.amount ?? 0)),
      },
    };
  }

  async join(storeId: string) {
    await this.prisma.store.update({
      where: { id: storeId },
      data: { shareSaveEnabled: true, shareSaveJoinedAt: new Date() },
    });
    return this.getStatus(storeId);
  }

  async leave(storeId: string) {
    await this.prisma.store.update({
      where: { id: storeId },
      data: { shareSaveEnabled: false },
    });
    return this.getStatus(storeId);
  }
}
