import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FcmService } from './fcm.service';

const MAX_TOKENS_PER_USER = 5;

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly fcm:    FcmService,
    private readonly prisma: PrismaService,
  ) {}

  private async getUserTokens(userId: string): Promise<string[]> {
    const records = await this.prisma.fcmToken.findMany({
      where:   { userId },
      select:  { token: true },
      orderBy: { lastSeen: 'desc' },
      take:    MAX_TOKENS_PER_USER,
    });
    return records.map((r) => r.token);
  }

  private async removeStaleTokens(staleTokens: string[]): Promise<void> {
    if (staleTokens.length === 0) return;
    await this.prisma.fcmToken.deleteMany({ where: { token: { in: staleTokens } } });
  }

  async sendToUser(
    userId:  string,
    payload: { title: string; body: string; clickAction?: string; imageUrl?: string; data?: Record<string, string> },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { pushEnabled: true },
    });
    if (!user?.pushEnabled) return;

    const tokens = await this.getUserTokens(userId);
    if (tokens.length === 0) return;

    const result = await this.fcm.sendToTokens(tokens, payload);

    if (result.staleTokens.length > 0) {
      this.removeStaleTokens(result.staleTokens).catch((err: Error) =>
        this.logger.warn(`Failed to clean stale tokens: ${err.message}`),
      );
    }

    this.logger.log(
      `Push sent: user=${userId} sent=${result.sent} failed=${result.failed}`,
    );
  }

  async notifyOrderShipped(userId: string, orderNumber: string, carrier: string): Promise<void> {
    await this.sendToUser(userId, {
      title:       'Your order is on its way! 🚚',
      body:        `Order #${orderNumber} shipped via ${carrier}`,
      clickAction: `/account/orders/${orderNumber}`,
      data:        { type: 'order_shipped', orderNumber },
    });
  }

  async notifyNewMessage(userId: string, conversationId: string): Promise<void> {
    await this.sendToUser(userId, {
      title:       'DailyDaisy replied 💬',
      body:        'You have a new message from the shop',
      clickAction: '/account/messages',
      data:        { type: 'new_message', conversationId },
    });
  }

  async notifyPointsConfirmed(userId: string, points: number): Promise<void> {
    await this.sendToUser(userId, {
      title:       `⭐ ${points.toLocaleString()} points unlocked!`,
      body:        'Your loyalty points are now available to use at checkout',
      clickAction: '/account/loyalty',
      data:        { type: 'points_confirmed', points: String(points) },
    });
  }
}
