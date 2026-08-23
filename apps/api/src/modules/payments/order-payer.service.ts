import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Decides whether a caller may act on an order's payment.
 *
 * Not a Nest guard on purpose: the answer depends on which order the request
 * names, and for the capture route that order is only reachable through the
 * PayPal order id in the body. A plain service the payment paths call keeps
 * one rule in one place instead of two guards that drift.
 *
 * The rule has two halves, because checkout supports guests:
 *
 *  - An order that belongs to an account may only be paid by that account.
 *    Without this, knowing an order id was enough to drive someone else's
 *    payment — create a PayPal order against it, or capture one they had
 *    approved. Nothing here moves money to an attacker, but it lets a
 *    stranger change the state of an order that is not theirs.
 *
 *  - A guest order has no account to compare against, so possession of the
 *    order's cuid is the credential. That is the same standing the guest
 *    themselves has: the id is unguessable, is never listed anywhere public,
 *    and is the only thing the buyer was given.
 */
@Injectable()
export class OrderPayerService {
  constructor(private readonly prisma: PrismaService) {}

  /** @param userId the authenticated caller, or undefined for a guest. */
  async assertMayPayForOrder(orderId: string, userId?: string): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where:  { id: orderId },
      select: { id: true, userId: true },
    });

    // Same shape the payment services already throw for a missing order, so
    // this check cannot be used to tell "no such order" from "not yours".
    if (!order) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });
    }

    if (order.userId && order.userId !== userId) {
      throw new ForbiddenException({
        code:    'ERR_FORBIDDEN',
        message: 'This order belongs to another account',
      });
    }
  }

  /** Capture only knows the PayPal order id, so resolve the order through it. */
  async assertMayCapture(paypalOrderId: string, userId?: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where:  { paypalOrderId },
      select: { orderId: true },
    });

    if (!payment) {
      throw new NotFoundException({
        code:    'ERR_NOT_FOUND',
        message: 'No pending payment found for this PayPal order',
      });
    }

    await this.assertMayPayForOrder(payment.orderId, userId);
  }
}
