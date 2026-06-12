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
    if (!buyerEmail && storeOrder.order.userId) {
      const user = await this.prisma.user.findUnique({
        where:  { id: storeOrder.order.userId },
        select: { email: true },
      });
      buyerEmail = user?.email ?? null;
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

  async requestPayout(storeId: string, body: { amount?: number; notes?: string }) {
    const available = await this.prisma.storeOrder.aggregate({
      where: { storeId, status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as OrderStatus[] }, payoutId: null },
      _sum: { sellerEarnings: true },
    });
    const balance = Number(available._sum?.sellerEarnings ?? 0);
    const amount  = body.amount ?? balance;
    if (amount <= 0) throw new Error('Nothing to pay out');
    return this.prisma.sellerPayout.create({
      data: {
        storeId,
        amount,
        status: 'PENDING',
        period: new Date().toISOString().slice(0, 7),
        platformFee: Math.round(Number(amount) * 0.05 * 100) / 100,
      },
    });
  }
}
