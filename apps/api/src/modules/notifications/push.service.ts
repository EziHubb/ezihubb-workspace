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

  /**
 * Unread messages across everything this user is part of.
   *
   * Read from the denormalised per-conversation counter rather than counted
   * off the messages table, because that counter is what the inbox and the
   * sidebar already display — a second definition would let the number on the
   * app icon disagree with the number inside the app.
   *
   * Called after the write that incremented it, so it already includes the
   * message being announced.
   */
  private async unreadTotal(userId: string): Promise<number> {
    const agg = await this.prisma.conversation.aggregate({
      // hiddenByCustomerAt mirrors getMyConversations, which is what feeds the
      // list the buyer actually sees. Summing over every conversation instead
      // would count threads they have hidden, and the figure on the app icon
      // would exceed anything they could find inside the app to clear it.
      where: { userId, hiddenByCustomerAt: null },
      _sum:  { unreadByCustomer: true },
    });
    return agg._sum.unreadByCustomer ?? 0;
  }

  async notifyNewMessage(userId: string, conversationId: string): Promise<void> {
    // Carried in the payload because the worker that draws the badge runs
    // with the app closed and has no session to ask. Sent as a string: FCM
    // data values are strings, and a number here would be coerced silently.
    const unreadCount = await this.unreadTotal(userId);

    await this.sendToUser(userId, {
      title:       'EziHubb replied 💬',
      body:        'You have a new message from the shop',
      clickAction: '/account/messages',
      data:        { type: 'new_message', conversationId, unreadCount: String(unreadCount) },
    });
  }

}
