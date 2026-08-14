import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { JOBS, QUEUES, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { paginatedResponse } from '../../common/dto/paginated-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { TargetedOffersService } from '../marketing/targeted-offers.service';

export class UpdateStoreOrderDto {
  @IsEnum(OrderStatus)
  @IsOptional()
  status?: 'IN_PRODUCTION' | 'SHIPPED' | 'DELIVERED';

  @IsString()
  @IsOptional()
  trackingNumber?: string;

  @IsString()
  @IsOptional()
  trackingUrl?: string;

  @IsString()
  @IsOptional()
  carrier?: string;

  @IsString()
  @IsOptional()
  sellerNotes?: string;
}

const SELLER_UPDATABLE_STATUSES = ['IN_PRODUCTION', 'SHIPPED', 'DELIVERED'];

@Injectable()
export class StoreOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    private readonly targetedOffersService: TargetedOffersService,
  ) {}

  // ─── Seller: List their store's orders ────────────────────────────────────

  async listStoreOrders(storeId: string, pagination: PaginationDto & { status?: OrderStatus }) {
    const page  = pagination.page  ?? 1;
    const limit = pagination.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: any = { storeId };
    if (pagination.status) where.status = pagination.status;

    const [orders, total] = await Promise.all([
      this.prisma.storeOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              orderNumber: true,
              createdAt:   true,
              shippingCity: true,
              user:        { select: { firstName: true } },
              guestEmail:  true,
            },
          },
          items: {
            select: {
              productName: true,
              variantName: true,
              quantity:    true,
              unitPrice:   true,
              productImageUrl: true,
            },
          },
        },
      }),
      this.prisma.storeOrder.count({ where }),
    ]);

    return paginatedResponse(orders, page, limit, total);
  }

  // ─── Seller: Get single order detail ──────────────────────────────────────

  async getStoreOrderDetail(storeId: string, storeOrderId: string) {
    const order = await this.prisma.storeOrder.findUnique({
      where:   { id: storeOrderId },
      include: {
        order: {
          select: {
            orderNumber: true,
            shippingCity: true,
            createdAt:   true,
            user: { select: { firstName: true } },
          },
        },
        items: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.storeId !== storeId) throw new ForbiddenException('Access denied');

    return order;
  }

  // ─── Seller: Update order (tracking, status) ──────────────────────────────

  async updateStoreOrder(storeId: string, storeOrderId: string, dto: UpdateStoreOrderDto) {
    const order = await this.prisma.storeOrder.findUnique({ where: { id: storeOrderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.storeId !== storeId) throw new ForbiddenException('Access denied');

    if (dto.status && !SELLER_UPDATABLE_STATUSES.includes(dto.status)) {
      throw new BadRequestException('Invalid status transition');
    }

    const updated = await this.prisma.storeOrder.update({
      where: { id: storeOrderId },
      data: {
        status:        dto.status        ?? undefined,
        trackingNumber: dto.trackingNumber ?? undefined,
        trackingUrl:    dto.trackingUrl   ?? undefined,
        carrier:        dto.carrier       ?? undefined,
        sellerNotes:    dto.sellerNotes   ?? undefined,
        shippedAt:    dto.status === 'SHIPPED' && !order.shippedAt ? new Date() : undefined,
        deliveredAt:  dto.status === 'DELIVERED' && !order.deliveredAt ? new Date() : undefined,
      },
    });

    return updated;
  }

  // ─── Seller: Mark as shipped (sends buyer email) ───────────────────────────

  async markStoreOrderShipped(storeId: string, storeOrderId: string, dto: {
    trackingNumber: string;
    trackingUrl?: string;
    carrier?: string;
  }) {
    const storeOrder = await this.prisma.storeOrder.findUnique({
      where:   { id: storeOrderId },
      include: {
        order: {
          select: {
            orderNumber:  true,
            guestEmail:   true,
            userId:       true,
            shippingName: true,
          },
        },
      },
    });

    if (!storeOrder) throw new NotFoundException('Order not found');
    if (storeOrder.storeId !== storeId) throw new ForbiddenException('Access denied');
    if (storeOrder.status === 'SHIPPED' || storeOrder.status === 'DELIVERED') {
      throw new BadRequestException('Order already shipped');
    }

    const updated = await this.prisma.storeOrder.update({
      where: { id: storeOrderId },
      data: {
        status:        'SHIPPED',
        trackingNumber: dto.trackingNumber,
        trackingUrl:    dto.trackingUrl ?? null,
        carrier:        dto.carrier     ?? null,
        shippedAt:      new Date(),
      },
    });

    // Notify buyer
    let buyerEmail: string | null = storeOrder.order.guestEmail ?? null;
    let buyerFirstName: string | null = null;
    if (storeOrder.order.userId) {
      const user = await this.prisma.user.findUnique({
        where:  { id: storeOrder.order.userId },
        select: { email: true, firstName: true },
      });
      if (!buyerEmail) buyerEmail = user?.email ?? null;
      buyerFirstName = user?.firstName ?? null;
    }

    // Etsy "Thank you" targeted offer — only for a logged-in buyer, since a
    // personalized single-use Promotion needs a targetUserId (guest checkouts
    // have no account for the code to be scoped to).
    if (storeOrder.order.userId && buyerEmail) {
      this.targetedOffersService
        .fireOffer(storeId, 'THANK_YOU', { id: storeOrder.order.userId, email: buyerEmail, firstName: buyerFirstName })
        .catch(() => undefined);
    }

    if (buyerEmail) {
      await this.emailQueue.add(JOBS.SEND_EMAIL, {
        to:       buyerEmail,
        template: 'order-shipped',
        subject:  `Your order ${storeOrder.order.orderNumber} has shipped!`,
        data: {
          orderNumber:    storeOrder.order.orderNumber,
          trackingNumber: dto.trackingNumber,
          trackingUrl:    dto.trackingUrl ?? null,
          carrier:        dto.carrier     ?? null,
          shippingName:   storeOrder.order.shippingName,
        },
      }, DEFAULT_JOB_OPTIONS);
    }

    return updated;
  }

  // ─── Seller: Dashboard stats ───────────────────────────────────────────────

  async getSellerDashboardStats(storeId: string) {
    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      ordersToday,
      revenueThisMonth,
      pendingShipments,
      store,
    ] = await Promise.all([
      this.prisma.storeOrder.count({
        where: { storeId, createdAt: { gte: today } },
      }),
      this.prisma.storeOrder.aggregate({
        where:  { storeId, status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as OrderStatus[] }, createdAt: { gte: monthStart } },
        _sum:   { sellerEarnings: true },
      }),
      this.prisma.storeOrder.count({
        where: { storeId, status: { in: ['CONFIRMED', 'IN_PRODUCTION'] as OrderStatus[] } },
      }),
      this.prisma.store.findUnique({
        where:  { id: storeId },
        select: { rating: true, totalOrders: true, totalRevenue: true },
      }),
    ]);

    return {
      ordersToday,
      revenueThisMonth: Number(revenueThisMonth._sum?.sellerEarnings ?? 0),
      pendingShipments,
      rating:           Number(store?.rating ?? 0),
    };
  }

  // ─── Seller: Recent orders ─────────────────────────────────────────────────

  async getRecentOrders(storeId: string, limit = 5) {
    return this.prisma.storeOrder.findMany({
      where:   { storeId },
      take:    limit,
      orderBy: { createdAt: 'desc' },
      include: {
        order: { select: { orderNumber: true, createdAt: true } },
        items: { select: { productName: true, quantity: true }, take: 3 },
      },
    });
  }

  // ─── Seller: Payout history ────────────────────────────────────────────────

  async getPayoutHistory(storeId: string, pagination: PaginationDto) {
    const page  = pagination.page  ?? 1;
    const limit = pagination.limit ?? 20;
    const skip  = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
      this.prisma.sellerPayout.findMany({
        where:   { storeId },
        skip,
        take:    limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sellerPayout.count({ where: { storeId } }),
    ]);

    // Available balance: confirmed sellerEarnings with no payoutId
    const available = await this.prisma.storeOrder.aggregate({
      where: {
        storeId,
        status:   { in: ['CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as OrderStatus[] },
        payoutId: null,
      },
      _sum: { sellerEarnings: true },
    });

    return {
      ...paginatedResponse(payouts, page, limit, total),
      availableBalance: Number(available._sum?.sellerEarnings ?? 0),
    };
  }

  async getOrderCounts(storeId: string) {
    const groups = await this.prisma.storeOrder.groupBy({
      by: ['status'],
      where: { storeId },
      _count: { id: true },
    });
    const counts: Record<string, number> = {};
    for (const g of groups) counts[g.status] = g._count.id;
    return counts;
  }

  /**
   * Etsy-style payout: pays out the seller's net ledger balance (sales minus
   * every itemized fee, including listing fees which aren't tied to any
   * order) rather than just summing StoreOrder.sellerEarnings — that field
   * only ever reflects order-linked fees, not listing fees. SellerLedgerEntry
   * is the source of truth here; StoreOrder.sellerEarnings stays as a
   * per-order display total only.
   */
  async requestPayout(storeId: string, body: { notes?: string }) {
    const unpaidEntries = await this.prisma.sellerLedgerEntry.findMany({
      where: { storeId, payoutId: null },
      select: { id: true, amount: true, storeOrderId: true },
    });
    if (unpaidEntries.length === 0) throw new Error('Nothing to pay out');

    const amount      = unpaidEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    const platformFee = unpaidEntries.reduce((sum, e) => sum + Math.min(0, Number(e.amount)), 0) * -1;
    if (amount <= 0) throw new Error('Nothing to pay out');

    const storeOrderIds = [...new Set(unpaidEntries.map((e) => e.storeOrderId).filter((id): id is string => !!id))];

    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.sellerPayout.create({
        data: {
          storeId,
          amount:      Math.round(amount * 100) / 100,
          platformFee: Math.round(platformFee * 100) / 100,
          orderCount:  storeOrderIds.length,
          status:      'PENDING',
          period:      new Date().toISOString().slice(0, 7),
          adminNotes:  body.notes,
        },
      });

      await tx.sellerLedgerEntry.updateMany({
        where: { id: { in: unpaidEntries.map((e) => e.id) } },
        data:  { payoutId: payout.id },
      });
      if (storeOrderIds.length > 0) {
        await tx.storeOrder.updateMany({
          where: { id: { in: storeOrderIds } },
          data:  { payoutId: payout.id },
        });
      }

      return payout;
    });
  }
}
