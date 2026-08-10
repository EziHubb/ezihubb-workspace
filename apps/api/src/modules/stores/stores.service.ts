import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { JOBS, QUEUES, DEFAULT_JOB_OPTIONS } from '../../queue/queue.constants';
import { ApplyStoreDto, isReservedSlug } from './dto/apply-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import {
  ApproveStoreDto,
  RejectStoreDto,
  SuspendStoreDto,
  AdminListStoresDto,
  UpdatePlatformSettingsDto,
} from './dto/admin-stores.dto';
import { paginatedResponse } from '../../common/dto/paginated-response.dto';

const SHOP_URL   = process.env['CLIENT_URL'] ?? 'https://ezihubb.com';
const ADMIN_URL  = process.env['ADMIN_URL']  ?? 'http://localhost:3001';

@Injectable()
export class StoresService {
  private readonly logger = new Logger(StoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.EMAIL) private readonly emailQueue: Queue,
    private readonly storageService: StorageService,
    @Optional() private readonly moderationService?: ModerationService,
  ) {}

  // ─── Seller: Apply ────────────────────────────────────────────────────────

  async applyForStore(userId: string, dto: ApplyStoreDto) {
    // Guard: user must not already own a store
    const existingStore = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (existingStore) {
      throw new ConflictException({ code: 'ERR_STORE_EXISTS', message: 'You already have a store' });
    }

    // Guard: slug uniqueness + reserved check
    if (isReservedSlug(dto.slug)) {
      throw new BadRequestException({ code: 'ERR_SLUG_RESERVED', message: 'This slug is reserved' });
    }
    const existingSlug = await this.prisma.store.findUnique({ where: { slug: dto.slug } });
    if (existingSlug) {
      throw new ConflictException({ code: 'ERR_SLUG_TAKEN', message: 'This store URL is already taken' });
    }

    // Guard: platform settings allow registration
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!settings?.allowPublicRegistration && user?.role === 'CUSTOMER') {
      throw new ForbiddenException({ code: 'ERR_REGISTRATION_CLOSED', message: 'Store applications are by invitation only' });
    }

    const store = await this.prisma.store.create({
      data: {
        slug:        dto.slug,
        name:        dto.name,
        description: dto.description,
        ownerId:     userId,
        status:      'PENDING',
      },
    });

    // fire-and-forget
    this.moderationService?.queueStoreModeration(store.id).catch((e) => this.logger.error('mod queue failed', e));

    // Notify seller
    await this.emailQueue.add(JOBS.SEND_EMAIL, {
      to:       user?.email,
      template: 'store-application-received',
      subject:  'We received your EziHubb store application',
      data:     { firstName: user?.firstName, storeName: store.name, shopUrl: SHOP_URL },
    }, DEFAULT_JOB_OPTIONS);

    // Notify admins
    const admins = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
      select: { email: true, firstName: true },
    });
    for (const admin of admins) {
      await this.emailQueue.add(JOBS.SEND_EMAIL, {
        to:       admin.email,
        template: 'new-store-application',
        subject:  `New store application: ${store.name}`,
        data:     { adminName: admin.firstName, storeName: store.name, sellerEmail: user?.email, adminUrl: `${SHOP_URL}/admin` },
      }, DEFAULT_JOB_OPTIONS);
    }

    return store;
  }

  // ─── Seller: Get / Update ─────────────────────────────────────────────────

  async getMyStore(userId: string) {
    return this.prisma.store.findUnique({
      where: { ownerId: userId },
    });
  }

  async getMyStoreApplication(userId: string) {
    const store = await this.prisma.store.findUnique({
      where:  { ownerId: userId },
      select: { id: true, name: true, status: true, rejectedReason: true, createdAt: true, updatedAt: true },
    });
    return store ?? { status: 'NONE' };
  }

  async updateMyStore(userId: string, dto: UpdateStoreDto) {
    const store = await this.prisma.store.findUnique({ where: { ownerId: userId } });
    if (!store) throw new NotFoundException('Store not found');
    if (store.status !== 'ACTIVE') {
      throw new ForbiddenException('Only active stores can be updated');
    }

    const updatedStore = await this.prisma.store.update({
      where: { id: store.id },
      data:  {
        name:        dto.name        ?? undefined,
        description: dto.description ?? undefined,
        logoUrl:     dto.logoUrl     ?? undefined,
        bannerUrl:   dto.bannerUrl   ?? undefined,
      },
    });

    // fire-and-forget
    this.moderationService?.queueStoreModeration(updatedStore.id).catch((e) => this.logger.error('mod queue failed', e));

    return updatedStore;
  }

  // ─── Public: Store list ───────────────────────────────────────────────────

  async listStores(page = 1, limit = 12) {
    const where = { status: 'ACTIVE' as const };
    const skip  = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.store.count({ where }),
      this.prisma.store.findMany({
        where,
        skip,
        take:    limit,
        orderBy: { rating: 'desc' },
        select: {
          id: true, slug: true, name: true, description: true,
          logoUrl: true, bannerUrl: true,
          totalProducts: true, rating: true,
        },
      }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }

  // ─── Public: Store page ───────────────────────────────────────────────────

  async getStoreBySlug(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      select: {
        id: true, slug: true, name: true, description: true,
        logoUrl: true, bannerUrl: true, status: true,
        totalProducts: true, totalOrders: true, rating: true,
        createdAt: true, verifiedAt: true,
      },
    });

    if (!store || store.status === 'PENDING' || store.status === 'REJECTED') {
      throw new NotFoundException('Store not found');
    }

    return store;
  }

  // ─── Public: Store sections (shop sections sidebar) ───────────────────────

  async getStoreSections(slug: string) {
    const store = await this.prisma.store.findUnique({
      where:  { slug },
      select: { id: true, status: true },
    });
    if (!store || store.status === 'PENDING' || store.status === 'REJECTED') {
      throw new NotFoundException('Store not found');
    }

    const baseWhere = { storeId: store.id, isActive: true, deletedAt: null as null };

    const [total, onSaleCount, shopSections] = await Promise.all([
      this.prisma.product.count({ where: baseWhere }),
      this.prisma.product.count({
        where: { ...baseWhere, NOT: { compareAtPrice: null } },
      }),
      this.prisma.shopSection.findMany({
        where:   { storeId: store.id },
        select: {
          id:       true,
          name:     true,
          sortOrder: true,
          _count:   { select: { products: { where: baseWhere } } },
        },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    return {
      total,
      onSale: onSaleCount,
      sections: shopSections
        .filter((s) => s._count.products > 0)
        .map((s) => ({
          id:    s.id,
          name:  s.name,
          count: s._count.products,
        })),
    };
  }

  // ─── Public: Store performance score ─────────────────────────────────────

  async getStoreScorePublic(slug: string) {
    const store = await this.prisma.store.findUnique({
      where: { slug },
      select: {
        performanceScore: true, scoreShipping: true, scoreRefund: true,
        scoreReview: true, scoreResponse: true, scoreBadge: true, scoreLastCalculatedAt: true,
      },
    });
    if (!store) return null;
    return store;
  }

  // ─── Admin: List stores ───────────────────────────────────────────────────

  async adminListStores(dto: AdminListStoresDto, scopedOwnerId?: string) {
    const page  = dto.page  ?? 1;
    const limit = dto.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: any = {};
    // Shop owners (ADMIN role) can only see their own store(s)
    if (scopedOwnerId) where.ownerId = scopedOwnerId;
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { name:  { contains: dto.search, mode: 'insensitive' } },
        { slug:  { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where,
        skip,
        take: limit,
        include: { owner: { select: { email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.store.count({ where }),
    ]);

    return paginatedResponse(stores, page, limit, total);
  }

  async adminGetStore(storeId: string, scopedOwnerId?: string) {
    const store = await this.prisma.store.findUnique({
      where:   { id: storeId },
      include: {
        owner:   { select: { id: true, email: true, firstName: true, lastName: true } },
        payouts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    // Shop owners (ADMIN role) can only access their own store
    if (scopedOwnerId && store.ownerId !== scopedOwnerId) {
      throw new NotFoundException('Store not found');
    }
    return store;
  }

  // ─── Admin: Approve ───────────────────────────────────────────────────────

  async adminApproveStore(storeId: string, adminId: string, dto: ApproveStoreDto) {
    const store = await this.prisma.store.findUnique({
      where:   { id: storeId },
      include: { owner: { select: { email: true, firstName: true } } },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store.status !== 'PENDING') {
      throw new BadRequestException('Only pending stores can be approved');
    }

    const updatedStore = await this.prisma.$transaction(async (tx) => {
      const s = await tx.store.update({
        where: { id: storeId },
        data: {
          status:       'ACTIVE',
          verifiedAt:   new Date(),
          approvedById: adminId,
        },
      });

      // Link the store to its owner. Only promote role to ADMIN when the
      // applicant is a plain CUSTOMER — a SUPER_ADMIN who applies for their
      // own store (e.g. platform staff running a personal shop) keeps full
      // platform privileges; approval must never silently demote them.
      const owner = await tx.user.findUniqueOrThrow({ where: { id: store.ownerId }, select: { role: true } });
      await tx.user.update({
        where: { id: store.ownerId },
        data:  {
          isSeller:    true,
          storeId:     store.id,
          ...(owner.role === 'CUSTOMER' ? { role: 'ADMIN' as const } : {}),
          permissions: { roles: ['shop_owner'] },
        },
      });

      return s;
    });

    // fire-and-forget
    this.moderationService?.queueStoreModeration(storeId).catch((e) => this.logger.error('mod queue failed', e));

    await this.emailQueue.add(JOBS.SEND_EMAIL, {
      to:       store.owner.email,
      template: 'store-approved',
      subject:  `🎉 Your store "${store.name}" is approved — here's how to get started`,
      data: {
        firstName:       store.owner.firstName,
        storeName:       store.name,
        storeUrl:        `${SHOP_URL}/shops/${store.slug}`,
        adminPanelUrl:   ADMIN_URL,
        adminLoginUrl:   `${ADMIN_URL}/login`,
      },
    }, DEFAULT_JOB_OPTIONS);

    return updatedStore;
  }

  // ─── Admin: Reject ────────────────────────────────────────────────────────

  async adminRejectStore(storeId: string, adminId: string, dto: RejectStoreDto) {
    const store = await this.prisma.store.findUnique({
      where:   { id: storeId },
      include: { owner: { select: { email: true, firstName: true } } },
    });
    if (!store) throw new NotFoundException('Store not found');

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data:  { status: 'REJECTED', rejectedReason: dto.reason, approvedById: adminId },
    });

    await this.emailQueue.add(JOBS.SEND_EMAIL, {
      to:       store.owner.email,
      template: 'store-rejected',
      subject:  'Update on your EziHubb store application',
      data: {
        firstName: store.owner.firstName,
        storeName: store.name,
        reason:    dto.reason,
        shopUrl:   SHOP_URL,
      },
    }, DEFAULT_JOB_OPTIONS);

    return updated;
  }

  // ─── Admin: Suspend ───────────────────────────────────────────────────────

  async adminSuspendStore(storeId: string, adminId: string, dto: SuspendStoreDto) {
    const store = await this.prisma.store.findUnique({
      where:   { id: storeId },
      include: { owner: { select: { email: true, firstName: true } } },
    });
    if (!store) throw new NotFoundException('Store not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const s = await tx.store.update({
        where: { id: storeId },
        data:  { status: 'SUSPENDED', adminNotes: dto.reason },
      });
      // Hide all store products from storefront
      await tx.product.updateMany({
        where: { storeId },
        data:  { status: 'INACTIVE' },
      });
      return s;
    });

    await this.emailQueue.add(JOBS.SEND_EMAIL, {
      to:       store.owner.email,
      template: 'store-suspended',
      subject:  'Your EziHubb store has been suspended',
      data: {
        firstName: store.owner.firstName,
        storeName: store.name,
        reason:    dto.reason,
        shopUrl:   SHOP_URL,
      },
    }, DEFAULT_JOB_OPTIONS);

    return updated;
  }

  // ─── Platform Settings ────────────────────────────────────────────────────

  async getPlatformSettings() {
    return this.prisma.platformSettings.upsert({
      where:  { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    });
  }

  async updatePlatformSettings(dto: UpdatePlatformSettingsDto) {
    return this.prisma.platformSettings.upsert({
      where:  { id: 'singleton' },
      update: dto,
      create: { id: 'singleton', ...dto },
    });
  }

  // ─── Admin: Seller Payouts ────────────────────────────────────────────────

  async adminListPayouts(params: { page?: number; limit?: number; status?: string }) {
    const page  = params.page  ?? 1;
    const limit = params.limit ?? 20;
    const skip  = (page - 1) * limit;
    const where: any = {};
    if (params.status) where.status = params.status;

    const [payouts, total] = await Promise.all([
      this.prisma.sellerPayout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { store: { select: { name: true, slug: true } } },
      }),
      this.prisma.sellerPayout.count({ where }),
    ]);

    return paginatedResponse(payouts, page, limit, total);
  }

  async adminMarkPayoutPaid(payoutId: string, adminId: string, dto: { paymentMethod: string; paymentDetail?: string; adminNotes?: string }) {
    const payout = await this.prisma.sellerPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === 'PAID') throw new BadRequestException('Payout already paid');

    return this.prisma.sellerPayout.update({
      where: { id: payoutId },
      data: {
        status:        'PAID',
        paidAt:        new Date(),
        processedById: adminId,
        paymentMethod: dto.paymentMethod,
        paymentDetail: dto.paymentDetail ?? null,
        adminNotes:    dto.adminNotes    ?? null,
      },
    });
  }

  // ─── Admin: Finance Stats ─────────────────────────────────────────────────

  async getFinanceStats() {
    const today      = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalFees,
      feesThisMonth,
      pendingPayouts,
      paidPayouts,
      activeStores,
    ] = await Promise.all([
      this.prisma.storeOrder.aggregate({
        where:  { status: { not: 'CANCELLED' } },
        _sum:   { platformFee: true },
      }),
      this.prisma.storeOrder.aggregate({
        where:  { status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } },
        _sum:   { platformFee: true },
      }),
      this.prisma.sellerPayout.aggregate({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
        _sum:  { amount: true },
        _count: true,
      }),
      this.prisma.sellerPayout.aggregate({
        where: { status: 'PAID' },
        _sum:  { amount: true },
        _count: true,
      }),
      this.prisma.store.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      totalFeesCollected:    Number(totalFees._sum.platformFee    ?? 0),
      feesThisMonth:         Number(feesThisMonth._sum.platformFee ?? 0),
      pendingPayoutAmount:   Number(pendingPayouts._sum.amount ?? 0),
      pendingPayoutCount:    pendingPayouts._count,
      totalPaidOutAmount:    Number(paidPayouts._sum.amount ?? 0),
      totalPaidOutCount:     paidPayouts._count,
      activeStores,
    };
  }

  async getFinanceChart(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
    const rows = await this.prisma.$queryRaw<{ date: string; fees: number; payouts: number }[]>`
      SELECT
        TO_CHAR(so."createdAt", 'YYYY-MM-DD') AS date,
        COALESCE(SUM(so."platformFee"), 0)::float AS fees,
        0::float AS payouts
      FROM "StoreOrder" so
      WHERE so."createdAt" >= ${since} AND so.status <> 'CANCELLED'
      GROUP BY date
      ORDER BY date ASC
    `;
    return rows.map((r) => ({ date: r.date, fees: Number(r.fees), payouts: Number(r.payouts) }));
  }

  async getStoreFinanceList(query: { page: number; limit: number }) {
    const { page, limit } = query;
    const [stores, total] = await Promise.all([
      this.prisma.store.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true, name: true, slug: true,
          _count: { select: { storeOrders: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.store.count({ where: { status: 'ACTIVE' } }),
    ]);
    return { data: stores, total, page, totalPages: Math.ceil(total / limit) };
  }

  async adminPayoutStats() {
    const [pending, processing, paid, totalPaidAmount] = await Promise.all([
      this.prisma.sellerPayout.count({ where: { status: 'PENDING' } }),
      this.prisma.sellerPayout.count({ where: { status: 'PROCESSING' } }),
      this.prisma.sellerPayout.count({ where: { status: 'PAID' } }),
      this.prisma.sellerPayout.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    ]);
    return { pending, processing, paid, totalPaidAmount: Number(totalPaidAmount._sum.amount ?? 0) };
  }

  async adminGetStoreProducts(storeId: string, query: { page: number; limit: number }) {
    const { page, limit } = query;
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where: { storeId, deletedAt: null },
        select: { id: true, name: true, slug: true, status: true, basePrice: true, soldCount: true, createdAt: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where: { storeId, deletedAt: null } }),
    ]);
    return { data: products, total, page, totalPages: Math.ceil(total / limit) };
  }

  async adminGetStoreOrders(storeId: string, query: { page: number; limit: number }) {
    const { page, limit } = query;
    const [orders, total] = await Promise.all([
      this.prisma.storeOrder.findMany({
        where: { storeId },
        include: { order: { select: { id: true, createdAt: true, total: true, status: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.storeOrder.count({ where: { storeId } }),
    ]);
    return { data: orders, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Admin: Update store profile (name, description, urls) ──────────────

  async adminUpdateStore(
    storeId: string,
    dto: { name?: string; description?: string; bannerUrl?: string; logoUrl?: string },
  ) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data:  {
        name:        dto.name        ?? undefined,
        description: dto.description ?? undefined,
        bannerUrl:   dto.bannerUrl   ?? undefined,
        logoUrl:     dto.logoUrl     ?? undefined,
      },
    });

    if (dto.bannerUrl) {
      this.moderationService?.queueStoreImageModeration(storeId, dto.bannerUrl, 'banner').catch((e) => this.logger.error('mod queue failed', e));
    }
    if (dto.logoUrl) {
      this.moderationService?.queueStoreImageModeration(storeId, dto.logoUrl, 'logo').catch((e) => this.logger.error('mod queue failed', e));
    }

    return updated;
  }

  async adminUploadStoreBanner(storeId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException({ code: 'ERR_FILE_REQUIRED', message: 'Banner file is required' });

    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const key = this.storageService.generateKey(`stores/${storeId}`, file.originalname);
    const url = await this.storageService.uploadFile(file.buffer, key, file.mimetype);

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data:  { bannerUrl: url },
    });

    this.moderationService?.queueStoreImageModeration(storeId, url, 'banner').catch((e) => this.logger.error('mod queue failed', e));

    return { bannerUrl: url, store: updated };
  }

  async adminUploadStoreLogo(storeId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException({ code: 'ERR_FILE_REQUIRED', message: 'Logo file is required' });

    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const key = this.storageService.generateKey(`stores/${storeId}`, file.originalname);
    const url = await this.storageService.uploadFile(file.buffer, key, file.mimetype);

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data:  { logoUrl: url },
    });

    this.moderationService?.queueStoreImageModeration(storeId, url, 'logo').catch((e) => this.logger.error('mod queue failed', e));

    return { logoUrl: url, store: updated };
  }

  // ─── Public: Store Reviews ────────────────────────────────────────────────

  async getStoreReviewsSummary(slug: string) {
    const store = await this.prisma.store.findUnique({
      where:  { slug },
      select: { id: true, status: true },
    });
    if (!store || store.status === 'PENDING' || store.status === 'REJECTED') {
      throw new NotFoundException('Store not found');
    }

    const ratings = await this.prisma.review.findMany({
      where:  { product: { storeId: store.id }, status: 'APPROVED' },
      select: { rating: true },
    });

    const totalReviews = ratings.length;
    if (totalReviews === 0) {
      return { averageRating: 0, totalReviews: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    }

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    for (const r of ratings) {
      distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
      sum += r.rating;
    }

    return {
      averageRating: parseFloat((sum / totalReviews).toFixed(1)),
      totalReviews,
      distribution,
    };
  }

  async getStoreReviews(slug: string, page: number, limit: number) {
    const store = await this.prisma.store.findUnique({
      where:  { slug },
      select: { id: true, status: true },
    });
    if (!store || store.status === 'PENDING' || store.status === 'REJECTED') {
      throw new NotFoundException('Store not found');
    }

    const skip = (page - 1) * limit;

    const [reviews, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { product: { storeId: store.id }, status: 'APPROVED' },
        select: {
          id:          true,
          rating:      true,
          title:       true,
          body:        true,
          imageUrls:   true,
          createdAt:   true,
          sellerReply: true,
          user: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          product: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({
        where: { product: { storeId: store.id }, status: 'APPROVED' },
      }),
    ]);

    const mapped = reviews.map((r) => ({
      id:          r.id,
      rating:      r.rating,
      title:       r.title,
      body:        r.body,
      imageUrls:   r.imageUrls,
      createdAt:   r.createdAt,
      sellerReply: r.sellerReply,
      author: r.user
        ? { id: r.user.id, firstName: r.user.firstName, lastName: r.user.lastName, avatarUrl: r.user.avatarUrl }
        : { id: '', firstName: 'Customer', lastName: null, avatarUrl: null },
      product: r.product,
    }));

    return paginatedResponse(mapped, page, limit, total);
  }
}
