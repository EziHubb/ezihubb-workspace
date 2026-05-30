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
