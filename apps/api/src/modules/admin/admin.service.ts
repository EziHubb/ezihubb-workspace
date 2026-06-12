import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginatedResult,
  paginatedResponse,
} from '../../common/dto/paginated-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  DashboardKPIsDto,
  OrdersByStatusDto,
  RevenueChartPointDto,
  TopProductDto,
} from './dto/dashboard.dto';
import { ReviewResponseDto } from '../reviews/dto/review-response.dto';
import { OrderStatus, ReviewStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKPIs(): Promise<DashboardKPIsDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      revenueResult,
      totalOrders,
      totalCustomers,
      pendingOrders,
      ordersInProduction,
      pendingReviews,
      monthlyRevenue,
      ordersThisMonth,
      newCustomersThisMonth,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID' },
      }),
      this.prisma.order.count(),
      this.prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
      this.prisma.order.count({
        where: { status: OrderStatus.PENDING_PAYMENT },
      }),
      this.prisma.order.count({ where: { status: OrderStatus.IN_PRODUCTION } }),
      this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID', paidAt: { gte: startOfMonth } },
      }),
      this.prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.user.count({
        where: {
          role: 'CUSTOMER',
          deletedAt: null,
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    const totalRevenue = Number(revenueResult._sum.amount ?? 0);
    const revenueThisMonth = Number(monthlyRevenue._sum.amount ?? 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalOrders,
      totalCustomers,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      pendingOrders,
      ordersInProduction,
      pendingReviews,
      revenueThisMonth,
      ordersThisMonth,
      newCustomersThisMonth,
    };
  }

  async getRevenueChart(days: number): Promise<RevenueChartPointDto[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);

    const rows = await this.prisma.$queryRaw<
      { date: string; revenue: number; orders: bigint }[]
    >`
      SELECT
        TO_CHAR(o."createdAt", 'YYYY-MM-DD') AS date,
        COALESCE(SUM(p.amount), 0)::float       AS revenue,
        COUNT(o.id)                             AS orders
      FROM "Order" o
      LEFT JOIN "Payment" p
        ON p."orderId" = o.id AND p.status = 'PAID'
      WHERE o."createdAt" >= ${since}
      GROUP BY date
      ORDER BY date ASC
    `;

    return rows.map((r) => ({
      date: r.date,
      revenue: Number(r.revenue),
      orders: Number(r.orders),
    }));
  }

  async getOrdersByStatus(): Promise<OrdersByStatusDto[]> {
    const groups = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    const total = groups.reduce((sum, g) => sum + g._count.id, 0);
    if (total === 0) return [];

    return groups
      .sort((a, b) => b._count.id - a._count.id)
      .map((g) => ({
        status: g.status,
        count: g._count.id,
        percentage: Math.round((g._count.id / total) * 1000) / 10,
      }));
  }

  async getTopProducts(limit = 10): Promise<TopProductDto[]> {
    const rows = await this.prisma.$queryRaw<
      {
        productId: string;
        name: string;
        slug: string;
        soldCount: bigint;
        revenue: number;
        imageUrl: string | null;
      }[]
    >`
      SELECT
        p.id              AS "productId",
        p.name,
        p.slug,
        p."soldCount",
        COALESCE(SUM(oi."unitPrice" * oi.quantity), 0)::float AS revenue,
        (
          SELECT pi.url FROM "ProductImage" pi
          WHERE pi."productId" = p.id AND pi."isPrimary" = true
          LIMIT 1
        ) AS "imageUrl"
      FROM "Product" p
      LEFT JOIN "OrderItem" oi ON oi."productId" = p.id
      LEFT JOIN "Order" o      ON o.id = oi."orderId"
        AND o.status NOT IN ('CANCELLED', 'PENDING_PAYMENT')
      WHERE p."deletedAt" IS NULL
      GROUP BY p.id, p.name, p.slug, p."soldCount"
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      slug: r.slug,
      soldCount: Number(r.soldCount),
      revenue: Number(r.revenue),
      imageUrl: r.imageUrl,
    }));
  }

  async getPlatformStats() {
    const [totalStores, activeStores, pendingStores, totalProducts, totalRevenue] = await Promise.all([
      this.prisma.store.count(),
      this.prisma.store.count({ where: { status: 'ACTIVE' } }),
      this.prisma.store.count({ where: { status: 'PENDING' } }),
      this.prisma.product.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
    ]);
    return {
      totalStores,
      activeStores,
      pendingStores,
      totalProducts,
      totalRevenue: Number(totalRevenue._sum.amount ?? 0),
    };
  }

  async getRecentActivity(limit = 20) {
    const [recentOrders, recentUsers, recentStores] = await Promise.all([
      this.prisma.order.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: { id: true, createdAt: true, total: true, status: true, user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.user.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        where: { deletedAt: null },
        select: { id: true, email: true, firstName: true, lastName: true, createdAt: true, role: true },
      }),
      this.prisma.store.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, status: true, createdAt: true },
      }),
    ]);

    const events = [
      ...recentOrders.map((o) => ({ type: 'order', id: o.id, createdAt: o.createdAt, meta: { total: o.total, status: o.status, user: o.user } })),
      ...recentUsers.map((u) => ({ type: 'user_signup', id: u.id, createdAt: u.createdAt, meta: { email: u.email, name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(), role: u.role } })),
      ...recentStores.map((s) => ({ type: 'store', id: s.id, createdAt: s.createdAt, meta: { name: s.name, status: s.status } })),
    ];

    return events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }

  async getTopStores(limit = 5) {
    const rows = await this.prisma.$queryRaw<{ storeId: string; name: string; slug: string; revenue: number; ordersCount: bigint }[]>`
      SELECT
        s.id        AS "storeId",
        s.name,
        s.slug,
        COALESCE(SUM(p.amount), 0)::float AS revenue,
        COUNT(DISTINCT o.id)              AS "ordersCount"
      FROM "Store" s
      LEFT JOIN "Product" pr ON pr."storeId" = s.id
      LEFT JOIN "OrderItem" oi ON oi."productId" = pr.id
      LEFT JOIN "Order" o  ON o.id = oi."orderId" AND o.status NOT IN ('CANCELLED','PENDING_PAYMENT')
      LEFT JOIN "Payment" p ON p."orderId" = o.id AND p.status = 'PAID'
      WHERE s.status = 'ACTIVE'
      GROUP BY s.id, s.name, s.slug
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ storeId: r.storeId, name: r.name, slug: r.slug, revenue: Number(r.revenue), ordersCount: Number(r.ordersCount) }));
  }

  async getPendingReviews(
    query: PaginationDto,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { status: ReviewStatus.PENDING },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          product: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
    ]);

    const data: ReviewResponseDto[] = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      imageUrls: r.imageUrls,
      status: r.status,
      adminReply: r.adminReply,
      repliedAt: r.repliedAt,
      createdAt: r.createdAt,
      author: {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        avatarUrl: r.user.avatarUrl,
      },
    }));

    return paginatedResponse(data, page, limit, total);
  }
}
