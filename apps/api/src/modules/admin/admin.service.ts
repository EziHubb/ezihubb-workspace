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
  ShopHealthDto,
} from './dto/dashboard.dto';
import { ReviewResponseDto } from '../reviews/dto/review-response.dto';
import { OrderStatus, ReviewStatus, StoreStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKPIs(storeId?: string): Promise<DashboardKPIsDto> {
    if (storeId) return this.getStoreDashboardKPIs(storeId);

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

  /**
   * Same DTO shape as the platform-wide KPIs, but scoped to one store — a
   * plain shop-owner ADMIN was previously seeing raw platform-wide numbers
   * here (mislabeled as "their store"), since this endpoint had no store
   * filter at all. Uses StoreOrder (the per-seller order split) instead of
   * the platform-level Order/Payment tables.
   */
  private async getStoreDashboardKPIs(storeId: string): Promise<DashboardKPIsDto> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const PAID_STATUSES = ['CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED'] as OrderStatus[];

    const [
      store,
      pendingOrders,
      ordersInProduction,
      pendingReviews,
      monthlyRevenue,
      ordersThisMonth,
      customerRows,
    ] = await Promise.all([
      this.prisma.store.findUniqueOrThrow({ where: { id: storeId }, select: { totalOrders: true, totalRevenue: true } }),
      this.prisma.storeOrder.count({ where: { storeId, status: OrderStatus.PENDING_PAYMENT } }),
      this.prisma.storeOrder.count({ where: { storeId, status: OrderStatus.IN_PRODUCTION } }),
      this.prisma.review.count({ where: { storeId, status: ReviewStatus.PENDING } }),
      this.prisma.storeOrder.aggregate({
        where: { storeId, status: { in: PAID_STATUSES }, createdAt: { gte: startOfMonth } },
        _sum:  { sellerEarnings: true },
      }),
      this.prisma.storeOrder.count({ where: { storeId, createdAt: { gte: startOfMonth } } }),
      this.prisma.storeOrder.findMany({
        where:  { storeId },
        select: { createdAt: true, order: { select: { userId: true, guestEmail: true } } },
      }),
    ]);

    const totalRevenue = Number(store.totalRevenue);
    const totalOrders = store.totalOrders;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const customerKey = (r: (typeof customerRows)[number]) => r.order.userId ?? r.order.guestEmail;
    const totalCustomers = new Set(customerRows.map(customerKey)).size;
    // Approximated as "distinct customers who ordered this month" — computing
    // true first-ever-purchase "new" status per store is a heavier query
    // not worth it for a dashboard tile.
    const newCustomersThisMonth = new Set(
      customerRows.filter((r) => r.createdAt >= startOfMonth).map(customerKey),
    ).size;

    return {
      totalRevenue,
      totalOrders,
      totalCustomers,
      averageOrderValue: Math.round(averageOrderValue * 100) / 100,
      pendingOrders,
      ordersInProduction,
      pendingReviews,
      revenueThisMonth: Number(monthlyRevenue._sum.sellerEarnings ?? 0),
      ordersThisMonth,
      newCustomersThisMonth,
    };
  }

  async getRevenueChart(days: number, storeId?: string): Promise<RevenueChartPointDto[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);

    if (storeId) {
      const rows = await this.prisma.$queryRaw<
        { date: string; revenue: number; orders: bigint }[]
      >`
        SELECT
          TO_CHAR(so."createdAt", 'YYYY-MM-DD') AS date,
          COALESCE(SUM(so."sellerEarnings"), 0)::float AS revenue,
          COUNT(so.id)                                 AS orders
        FROM "StoreOrder" so
        WHERE so."createdAt" >= ${since} AND so."storeId" = ${storeId}
        GROUP BY date
        ORDER BY date ASC
      `;
      return rows.map((r) => ({ date: r.date, revenue: Number(r.revenue), orders: Number(r.orders) }));
    }

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

  async getOrdersByStatus(storeId?: string): Promise<OrdersByStatusDto[]> {
    const groups = storeId
      ? await this.prisma.storeOrder.groupBy({ by: ['status'], where: { storeId }, _count: { id: true } })
      : await this.prisma.order.groupBy({ by: ['status'], _count: { id: true } });

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

  async getTopProducts(limit = 10, storeId?: string): Promise<TopProductDto[]> {
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
        AND (${storeId ?? null}::text IS NULL OR p."storeId" = ${storeId ?? null})
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
    storeId?: string,
  ): Promise<PaginatedResult<ReviewResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where = { status: ReviewStatus.PENDING, ...(storeId !== undefined && { storeId }) };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
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
      this.prisma.review.count({ where }),
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

  /** Backs the Dashboard search-visibility banner + shop checklist + Top
   *  tasks, and is reused as-is by /search-visibility and
   *  /customer-service-stats — a single aggregation over signals that
   *  already exist (Store profile fields, PerformanceScoreService's score
   *  fields, Conversation unread counts) rather than a new scoring engine. */
  async getShopHealth(storeId: string): Promise<ShopHealthDto> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        name: true, slug: true, logoUrl: true, bannerUrl: true, description: true, status: true,
        performanceScore: true, scoreShipping: true, scoreRefund: true, scoreReview: true, scoreResponse: true, scoreBadge: true,
        owner: { select: { avatarUrl: true } },
      },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const [
      activeListingNames, overdueOrders, ordersToSendToday,
      helpRequests, soldOutListings, inactiveListings,
      deliveryProfiles, processingProfiles, shopSections,
    ] = await Promise.all([
      // A title under 40 characters is unlikely to carry enough descriptive
      // keywords to surface well in search — a simple, honest heuristic
      // (no AI call) rather than the on-demand title-suggestion AI service,
      // which has no "pending suggestions" persisted state to count.
      this.prisma.product.findMany({
        where: { storeId, status: 'ACTIVE', deletedAt: null },
        select: { name: true },
      }),
      this.prisma.storeOrder.count({
        where: { storeId, status: { in: ['CONFIRMED', 'IN_PRODUCTION'] }, createdAt: { lt: threeDaysAgo } },
      }),
      this.prisma.storeOrder.count({
        where: { storeId, status: { in: ['CONFIRMED', 'IN_PRODUCTION'] }, createdAt: { gte: startOfToday } },
      }),
      this.prisma.conversation.count({ where: { storeId, status: 'OPEN', unreadByAdmin: { gt: 0 } } }),
      this.prisma.product.count({ where: { storeId, status: 'ACTIVE', deletedAt: null, trackInventory: true, quantity: 0 } }),
      this.prisma.product.count({ where: { storeId, status: 'INACTIVE', deletedAt: null } }),
      // Counted, not fetched: the guide only asks whether any exist. `take: 1`
      // on a findMany would do too, but count keeps the three setup signals
      // reading the same way.
      this.prisma.shippingProfile.count({ where: { storeId } }),
      this.prisma.processingProfile.count({ where: { storeId } }),
      this.prisma.shopSection.count({ where: { storeId } }),
    ]);
    const listingsNeedingTitleWork = activeListingNames.filter((p) => p.name.length < 40).length;

    return {
      shopName:       store?.name ?? null,
      shopSlug:       store?.slug ?? null,
      shopLogoUrl:    store?.logoUrl ?? null,
      activeListings: activeListingNames.length,
      checklist: {
        shopName:    !!store?.name,
        logo:        !!store?.logoUrl,
        banner:      !!store?.bannerUrl,
        story:       !!store?.description,
        sellerPhoto: !!store?.owner?.avatarUrl,
      },
      setup: {
        firstListing:      activeListingNames.length > 0,
        deliveryProfile:   deliveryProfiles   > 0,
        processingProfile: processingProfiles > 0,
        shopSection:       shopSections       > 0,
      },
      // A missing store reads as not approved rather than approved: the guide
      // errs towards telling the seller their shop cannot sell yet, which is
      // recoverable, over claiming it can when we could not confirm it.
      shopApproved: store?.status === StoreStatus.ACTIVE,
      listingsNeedingTitleWork,
      performanceScore: store?.performanceScore ?? null,
      scoreShipping:    store?.scoreShipping    ?? null,
      scoreRefund:      store?.scoreRefund      ?? null,
      scoreReview:      store?.scoreReview      ?? null,
      scoreResponse:    store?.scoreResponse    ?? null,
      scoreBadge:       store?.scoreBadge       ?? null,
      topTasks: {
        overdueOrders,
        ordersToSendToday,
        helpRequests,
        soldOutListings,
        // Etsy's "expired listings" is a time-limited-listing concept our
        // catalog doesn't have (listings stay live until archived) — INACTIVE
        // count is the closest honest proxy, not a literal equivalent.
        inactiveListings,
      },
    };
  }
}
