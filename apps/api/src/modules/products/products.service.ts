import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ModerationService } from '../moderation/moderation.service';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model } from 'mongoose';
import { Prisma, OrderStatus, ProductStatus, ProductImageType, PrintSide, ProductType } from '@prisma/client';
import { QUEUES, JOBS, DEFAULT_JOB_OPTIONS, RemoveBackgroundJobData } from '../../queue/queue.constants';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RedisService,
  CacheKeys,
  CacheTtl,
} from '../../common/services/redis.service';
import { StorageService } from '../../common/services/storage.service';
import { ProductDetail } from '../catalog/schemas/product-detail.schema';
import { AnalyticsService } from '../analytics/analytics.service';
import { TargetedOffersService } from '../marketing/targeted-offers.service';
import { getEffectivePrice } from './pricing.util';
import { BundleOffersService } from '../promotions/bundle-offers.service';
import type {
  CreateProductDetailDto,
  AttributeDto,
  VariantDto,
  CustomizationTemplateDto,
} from './dto/create-product-detail.dto';
import { ProductQueryDto, ProductSortBy } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { mapEtsyVariationSummaryToVariants } from './etsy-variation-summary.mapper';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductListItemDto } from './dto/product-list-item.dto';
import { toProductVideoDto, type ProductVideoRow } from './product-video.mapper';
import { checkExternalMediaUrl, parseIso8601Duration } from './external-video';
import {
  ProductResponseDto,
  VariantResponseDto,
  ProductImageResponseDto,
  ProductTagResponseDto,
  DigitalFileResponseDto,
  ProductVideoDto,
} from './dto/product-response.dto';
import {
  PaginatedResult,
  paginatedResponse,
} from '../../common/dto/paginated-response.dto';
import { AutoTranslateService } from '../translations/auto-translate.service';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PLATFORM_FEE_DEFAULTS } from '../stores/fees.util';

const execFileAsync = promisify(execFile);

const IN_DEMAND_KEY = (productId: string) => `product:demand:${productId}`;
const VIEW_LOCK_KEY = (slug: string, lockId: string) =>
  `product:view:lock:${slug}:${lockId}`;
const ALLOWED_IMAGE_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_VIDEO_MIMETYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);
const VIDEO_MAX_BYTES = 20 * 1024 * 1024; // generous ceiling — a compliant ~10s clip is normally a few MB
const VIDEO_MAX_DURATION_SECONDS = 10;
const VIDEO_DURATION_TOLERANCE_SECONDS = 0.5; // encoder/container rounding
const MAX_VIDEOS_PER_PRODUCT = 2;
// Poster frames are stored objects here, not CDN transforms, so each size is a
// real file we generate at upload. 105px square matches the card slot; the
// full-size frame keeps the clip's own aspect ratio for the gallery.
const VIDEO_POSTER_SQUARE_PX = 105;
// Seek past the opening frame, which is very often black or mid-fade.
const VIDEO_POSTER_SEEK_SECONDS = 1;
const ALLOWED_DIGITAL_FILE_MIMETYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/postscript', // .ai/.eps
  'application/illustrator',
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
]);
const DIGITAL_FILE_MAX_BYTES = 50 * 1024 * 1024;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly analyticsService: AnalyticsService,
    @InjectModel(ProductDetail.name)
    private readonly productDetailModel: Model<ProductDetail>,
    private readonly autoTranslate: AutoTranslateService,
    private readonly targetedOffersService: TargetedOffersService,
    private readonly bundleOffersService: BundleOffersService,
    @InjectQueue(QUEUES.IMAGE_PROCESSING) private readonly imageQueue: Queue,
    @Optional() private readonly moderationService?: ModerationService,
  ) {}

  // ─── Public — list ─────────────────────────────────────────────────────────

  async findAll(
    query: ProductQueryDto,
  ): Promise<PaginatedResult<ProductListItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

    const where = await this.buildWhereClause(query);
    const orderBy = this.buildOrderBy(query.sort);

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          images: {
            where: { isPrimary: true },
            select: { url: true },
            take: 1,
          },
          _count: { select: { reviews: { where: { status: 'APPROVED' } } } },
          store: { select: { id: true, name: true, slug: true } },
          videos: { orderBy: { sortOrder: 'asc' as const } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Batch rating aggregation, in-demand counts, and variant price range — avoid N+1
    const productIds = products.map((p) => p.id);
    const [ratingRows, inDemandEntries, priceRangeRows] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, status: 'APPROVED' },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      Promise.all(
        productIds.map((id) => this.redis.get<number>(IN_DEMAND_KEY(id))),
      ),
      this.prisma.productVariant.groupBy({
        by: ['productId'],
        // isAvailable + price-not-null: an all-null-priced (unpriced) or
        // all-retired variant set must fall back to basePrice downstream
        // (map lookup miss → null), not silently aggregate to $0.
        where: { productId: { in: productIds }, isAvailable: true, price: { not: null } },
        _min: { price: true },
        _max: { price: true },
      }),
    ]);

    const ratingMap = new Map(
      ratingRows.map((r) => [
        r.productId,
        r._count.rating ? Math.round((r._avg.rating ?? 0) * 10) / 10 : null,
      ]),
    );
    const inDemandMap = new Map(
      productIds.map((id, i) => [id, inDemandEntries[i] ?? 0]),
    );
    const priceRangeMap = new Map(
      priceRangeRows.map((r) => [
        r.productId,
        { min: Number(r._min.price), max: Number(r._max.price) },
      ]),
    );

    const data = products.map(
      (p) =>
        ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          sku: p.sku,
          basePrice: Number(p.basePrice),
          compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
          minPrice: priceRangeMap.get(p.id)?.min ?? null,
          maxPrice: priceRangeMap.get(p.id)?.max ?? null,
          primaryImageUrl: p.images[0]?.url ?? null,
          primaryImage:    p.images[0]?.url ?? null,
          images:          p.images.map((img) => ({ url: img.url, isPrimary: true })),
          categoryId: p.categoryId,
          categoryName: p.category.name,
          categorySlug: p.category.slug,
          // Third of three places mapping into ProductListItemDto — see the
          // note on that field. This one is inline rather than via
          // toListItems.
          primaryColors: p.primaryColors ?? [],
          productType: p.productType,
          videos: (p.videos ?? []).map(toProductVideoDto),
          isPersonalizable: p.isPersonalizable,
          isFeatured: p.isFeatured,
          isActive: p.isActive,
          status: p.status,
          quantity: p.quantity,
          viewCount: p.viewCount,
          soldCount: p.soldCount,
          averageRating: ratingMap.get(p.id) ?? null,
          reviewCount: p._count.reviews,
          inDemandCount: inDemandMap.get(p.id) ?? 0,
          createdAt: p.createdAt,
          storeId:   p.store?.id   ?? null,
          storeName: p.store?.name ?? null,
          storeSlug: p.store?.slug ?? null,
          store:     p.store       ?? null,
        }) satisfies ProductListItemDto,
    );

    return paginatedResponse<ProductListItemDto>(data, page, limit, total);
  }

  async getStats(storeId?: string): Promise<{ all: number; active: number; draft: number; inactive: number; archived: number }> {
    const base = storeId ? { storeId } : {};
    const [all, active, draft, inactive, archived] = await Promise.all([
      this.prisma.product.count({ where: base }),
      this.prisma.product.count({ where: { ...base, status: ProductStatus.ACTIVE } }),
      this.prisma.product.count({ where: { ...base, status: ProductStatus.DRAFT } }),
      this.prisma.product.count({ where: { ...base, status: ProductStatus.INACTIVE } }),
      this.prisma.product.count({ where: { ...base, status: ProductStatus.ARCHIVED } }),
    ]);
    return { all, active, draft, inactive, archived };
  }

  // ─── Public — detail ───────────────────────────────────────────────────────

  async findBySlug(
    slug: string,
    viewLockId?: string,
    userId?: string,
  ): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        store: { select: { id: true, name: true, slug: true } },
        variants: { orderBy: { sortOrder: 'asc' } },
        variationGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
        // Print files are never shown to shoppers — only MOCKUP rows belong
        // on the public PDP.
        images: { where: { type: ProductImageType.MOCKUP }, orderBy: { sortOrder: 'asc' } },
        videos: { orderBy: { sortOrder: 'asc' } },
        // Metadata only (filename/mimeType/size) — storageKey is never selected
        // here, so it can never leak into the public product response.
        digitalFiles: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, filename: true, mimeType: true, sizeBytes: true, sortOrder: true, variantId: true },
        },
        tags: {
          include: { tag: { select: { id: true, name: true, slug: true } } },
        },
        _count: { select: { reviews: { where: { status: 'APPROVED' } } } },
      },
    });

    if (!product) {
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Product not found',
      });
    }

    // Debounced view count — one increment per session/IP per hour
    if (viewLockId) {
      const lockKey = VIEW_LOCK_KEY(slug, viewLockId);
      const seen = await this.redis.exists(lockKey);
      if (!seen) {
        await this.redis.set(lockKey, 1, 3600);
        await this.prisma.product
          .update({
            where: { id: product.id },
            data: { viewCount: { increment: 1 } },
          })
          .catch((e: Error) =>
            this.logger.warn(
              `Failed to increment view count for "${slug}": ${e.message}`,
            ),
          );
        if (product.store) {
          this.analyticsService
            .trackStoreMetric(product.store.id, 'productViews')
            .catch(() => undefined);
        }
      }
    }

    // Track recently viewed for authenticated users (fire-and-forget)
    if (userId) {
      this.analyticsService
        .trackRecentlyViewed(userId, product.id)
        .catch(() => undefined);
      this.recordInterestedShopperView(userId, product).catch(() => undefined);
    }

    const [inDemandCount, averageRating, mongoDetail, effectivePrice, bundleOffer] = await Promise.all([
      this.redis.get<number>(IN_DEMAND_KEY(product.id)).then((v) => v ?? 0),
      this.getAverageRating(product.id),
      // Fetch flexible product detail from MongoDB (non-blocking; fallback to PG data if unavailable)
      this.productDetailModel
        .findOne({ productId: product.id })
        .lean<ProductDetail>()
        .catch(() => null),
      // Etsy "Set up a sale" — resolved fresh on every view, same discipline
      // checkout already applies: never trust a stale/cached discounted price.
      product.storeId
        ? getEffectivePrice(this.prisma, product.id, product.storeId, Number(product.basePrice)).catch(() => null)
        : Promise.resolve(null),
      this.bundleOffersService.findActiveBundleForProduct(product.id).catch(() => null),
    ]);
    const salePromo = effectivePrice?.promotionId
      ? { type: effectivePrice.discountType as 'PERCENTAGE' | 'FIXED_AMOUNT', value: effectivePrice.discountValue as number }
      : null;

    // If the product has no store association (e.g. platform-created products),
    // fall back to the first active store so the seller card / shop chip still links correctly.
    const effectiveStore: { id: string; name: string; slug: string } | null =
      product.store ??
      (await this.prisma.store
        .findFirst({
          where:   { status: 'ACTIVE' },
          select:  { id: true, name: true, slug: true },
          orderBy: { createdAt: 'asc' },
        })
        .catch(() => null));

    const productForMapping = { ...product, store: effectiveStore };

    const base = this.mapToProductResponse(
      productForMapping as Parameters<typeof this.mapToProductResponse>[0],
      inDemandCount,
      averageRating,
    );

    // Derive variantOptions from VariationGroup+VariationOption — the admin-configurable source of truth
    const variantOptions = (product as typeof product & {
      variationGroups?: { name: string; options: { name: string }[] }[];
    }).variationGroups?.map((g) => ({
      name:   g.name,
      values: g.options.map((o) => o.name),
    })) ?? [];

    // Merge MongoDB fields on top of the PG response
    return {
      ...base,
      variantOptions,
      salePromo,
      bundleOffer,
      ...(mongoDetail && {
        richDescription:  mongoDetail.richDescription  ?? undefined,
        sizeGuide:        mongoDetail.sizeGuide         ?? undefined,
        shippingNote:     mongoDetail.shippingNote      ?? undefined,
        attributes:       mongoDetail.attributes        ?? [],
        mongoVariants:    mongoDetail.variants          ?? [],
        customization:    mongoDetail.customization     ?? null,
        printSpecs:       mongoDetail.printSpecs        ?? null,
      }),
    };
  }

  /**
   * Etsy "Interested shopper" targeted offer — fires when a logged-in buyer
   * views the same listing a 2nd time (a rolling Redis counter, since there's
   * no persistent per-user view-history table) without having bought it.
   * Reuses TargetedOffersService's own dedup (a lookback-scoped check against
   * already-issued codes), so this can fire on every qualifying view without
   * spamming the buyer.
   */
  private async recordInterestedShopperView(
    userId: string,
    product: { id: string; storeId: string | null; name: string },
  ): Promise<void> {
    if (!product.storeId) return;
    const count = await this.redis.increment(`interested-shopper:${userId}:${product.id}`, 30 * 24 * 3600);
    if (count < 2) return;

    const alreadyPurchased = await this.prisma.orderItem.findFirst({
      where: { productId: product.id, order: { userId } },
      select: { id: true },
    });
    if (alreadyPurchased) return;

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
    if (!user) return;

    await this.targetedOffersService.fireOffer(product.storeId, 'INTERESTED_SHOPPER', {
      id: userId,
      email: user.email,
      firstName: user.firstName,
    });
  }

  async findRelated(slugOrId: string): Promise<ProductListItemDto[]> {
    const product = await this.prisma.product.findFirst({
      where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
      select: { id: true, categoryId: true, tags: { select: { tagId: true } } },
    });
    if (!product) return [];

    const tagIds = product.tags.map((t) => t.tagId);

    const related = await this.prisma.product.findMany({
      where: {
        isActive: true,
        id: { not: product.id },
        OR: [
          { categoryId: product.categoryId },
          ...(tagIds.length
            ? [{ tags: { some: { tagId: { in: tagIds } } } }]
            : []),
        ],
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
        _count: { select: { reviews: { where: { status: 'APPROVED' } } } },
      },
      orderBy: { soldCount: 'desc' },
      take: 8,
    });

    return this.toListItems(related);
  }

  async findTrending(): Promise<ProductListItemDto[]> {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
        _count: { select: { reviews: { where: { status: 'APPROVED' } } } },
      },
      orderBy: { soldCount: 'desc' },
      take: 12,
    });

    return this.toListItems(products);
  }

  // ─── Admin — CRUD ──────────────────────────────────────────────────────────

  // ─── Admin — create draft ──────────────────────────────────────────────────

  async createDraft(): Promise<ProductResponseDto> {
    // Find any visible category as a placeholder (will be overwritten on publish)
    const placeholder = await this.prisma.category.findFirst({
      where:   { isVisible: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      select:  { id: true },
    });
    if (!placeholder) throw new BadRequestException({
      code:    'ERR_NO_CATEGORIES',
      message: 'No categories found — create at least one category before adding products.',
    });

    // Generate a unique draft SKU (will be replaced on publish)
    let sku: string;
    let skuConflict = true;
    do {
      sku = `DRAFT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      skuConflict = !!(await this.prisma.product.findUnique({ where: { sku } }));
    } while (skuConflict);

    const slug = await this.resolveUniqueProductSlug(sku.toLowerCase());

    const product = await this.prisma.product.create({
      data: {
        name:        '',
        slug,
        sku,
        description: '',
        basePrice:   0,
        categoryId:  placeholder.id,
        isActive:    false,
        status:      ProductStatus.DRAFT,
      },
    });

    // Re-use findByIdAdmin for a consistent full response shape
    return this.findByIdAdmin(product.id);
  }

  /**
   * Publish listings and bill them, atomically.
   *
   * THE ONLY place that turns a listing live. Both entry points — the
   * publish/unpublish bulk action and the seller's PATCH /:id/status — call
   * this, because splitting the rule across call sites is exactly what caused
   * the isActive/status desyncs documented in docs/listing-fee.md.
   *
   * All-or-nothing by design: ledger rows and the status flip share one
   * transaction, so a failure anywhere leaves nothing published and nothing
   * billed. Publishing 200 listings where one fails rolls back all 200 rather
   * than leaving a seller charged for listings that never went live.
   *
   * The fee is per listing, not per publish: unpublish -> republish, and any
   * listing already billed under the old create-time behaviour, are skipped by
   * the productId guard below.
   *
   * Takes ids only, no storeId — a platform-context SUPER_ADMIN can bulk
   * publish across several shops at once, so each product's own storeId
   * decides which ledger the fee lands in.
   */
  async publishProducts(ids: string[]): Promise<{ published: number; charged: number }> {
    if (!ids.length) return { published: 0, charged: 0 };

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where:  { id: { in: ids } },
        select: { id: true, storeId: true },
      });

      // storeId is nullable: platform-owned listings have no shop to bill.
      const billable = products.filter(
        (p): p is { id: string; storeId: string } => p.storeId !== null,
      );

      // One query for the whole batch, served by the
      // (storeId, productId, type) index added in 20260820000000.
      const already = await tx.sellerLedgerEntry.findMany({
        where:  { type: 'LISTING_FEE', productId: { in: billable.map((p) => p.id) } },
        select: { productId: true },
      });
      const alreadyCharged = new Set(already.map((e) => e.productId));
      const toCharge = billable.filter((p) => !alreadyCharged.has(p.id));

      if (toCharge.length) {
        const settings = await tx.platformSettings.findUnique({ where: { id: 'singleton' } });
        const listingFee = Number(settings?.listingFee ?? PLATFORM_FEE_DEFAULTS.listingFee);

        if (listingFee > 0) {
          const vatRate = Number(settings?.vatOnFeesRate ?? PLATFORM_FEE_DEFAULTS.vatOnFeesRate);
          const vat = Math.round(listingFee * vatRate * 100) / 100;

          const entries: Prisma.SellerLedgerEntryCreateManyInput[] = [];
          for (const p of toCharge) {
            entries.push({
              storeId:     p.storeId,
              productId:   p.id,
              type:        'LISTING_FEE',
              amount:      -listingFee,
              description: `Listing fee — product ${p.id}`,
            });
            if (vat > 0) {
              entries.push({
                storeId:     p.storeId,
                productId:   p.id,
                type:        'VAT',
                amount:      -vat,
                description: `VAT: listing — product ${p.id}`,
              });
            }
          }
          // No try/catch: a ledger failure must abort the publish. The old
          // create-time charge swallowed errors, which silently lost revenue
          // with nothing to reconcile against.
          await tx.sellerLedgerEntry.createMany({ data: entries });
        }
      }

      await tx.product.updateMany({
        where: { id: { in: ids } },
        data:  { status: ProductStatus.ACTIVE, isActive: true },
      });

      return { published: ids.length, charged: toCharge.length };
    });
  }

  private async resolveTagNames(names: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of names) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const tag = await this.prisma.tag.upsert({
        where:  { slug },
        create: { name, slug },
        update: {},
        select: { id: true },
      });
      ids.push(tag.id);
    }
    return ids;
  }

  /** Backs the Listings bulk "Editing tags" dialog — add or remove a single tag
   *  across many products at once, reusing the same upsert-by-slug tag resolution
   *  the single-product editor already uses. */
  async bulkEditTags(productIds: string[], mode: 'add' | 'remove', tagName: string): Promise<void> {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    if (mode === 'add') {
      const [tagId] = await this.resolveTagNames([trimmed]);
      await this.prisma.$transaction(
        productIds.map((productId) =>
          this.prisma.productTag.upsert({
            where:  { productId_tagId: { productId, tagId } },
            create: { productId, tagId },
            update: {},
          }),
        ),
      );
    } else {
      const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const tag = await this.prisma.tag.findUnique({ where: { slug }, select: { id: true } });
      if (tag) {
        await this.prisma.productTag.deleteMany({ where: { productId: { in: productIds }, tagId: tag.id } });
      }
    }
  }

  /** Backs the Listings bulk "Editing title" dialog. Etsy's "Reset title" option
   *  reverts to an auto-generated original that this catalog doesn't persist
   *  separately from the live title, so it isn't offered here — the other four
   *  modes (add to front/end, find and replace, delete) are plain string ops. */
  async bulkEditTitle(
    productIds: string[],
    mode: 'add-front' | 'add-end' | 'find-replace' | 'delete',
    text: string,
    findText?: string,
  ): Promise<void> {
    const products = await this.prisma.product.findMany({
      where:  { id: { in: productIds } },
      select: { id: true, name: true },
    });
    await this.prisma.$transaction(
      products.map((p) => {
        let name = p.name;
        if (mode === 'add-front')        name = `${text}${p.name}`;
        else if (mode === 'add-end')      name = `${p.name}${text}`;
        else if (mode === 'find-replace' && findText) name = p.name.split(findText).join(text);
        else if (mode === 'delete'        && text)     name = p.name.split(text).join('');
        return this.prisma.product.update({ where: { id: p.id }, data: { name } });
      }),
    );
  }

  // etsyVariationSummary arrives with no admin in the loop to separately set
  // up the "Manage Variations" picker (VariationGroup/Settings) the way the
  // manual create-product UI does — derive it here so the priced SKUs
  // created alongside the product are actually selectable on the storefront
  // and in admin.
  private async createVariationGroupsFor(
    productId: string,
    groups: { name: string; options: string[] }[],
  ): Promise<void> {
    if (!groups.length) return;
    await this.prisma.$transaction([
      ...groups.map((g, gi) =>
        this.prisma.variationGroup.create({
          data: {
            productId,
            name: g.name,
            sortOrder: gi,
            options: {
              create: g.options.map((name, oi) => ({
                name,
                value: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `option-${oi}`,
                sortOrder: oi,
              })),
            },
          },
        }),
      ),
      this.prisma.variationSettings.create({
        data: { productId, enableVariations: true, variesBy: ['price'] },
      }),
    ]);
  }

  async create(dto: CreateProductDto, storeId?: string): Promise<ProductResponseDto> {
    if (
      dto.compareAtPrice !== undefined &&
      dto.compareAtPrice <= dto.basePrice
    ) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: 'compareAtPrice must be greater than basePrice',
      });
    }

    // Accept Etsy's listing-page price-range summary as an alternative to
    // `variants` — `variants` (if provided) always wins, so a caller
    // migrating gradually can't have a stray etsyVariationSummary silently
    // override an explicit list. Resulting prices are estimates, not exact
    // (see the mapper for why), so this always forces the product to DRAFT.
    const variationSummary =
      !dto.variants?.length && dto.etsyVariationSummary?.length
        ? mapEtsyVariationSummaryToVariants(dto.etsyVariationSummary)
        : undefined;

    const variants = dto.variants?.length ? dto.variants : variationSummary?.variants;

    const skuExists = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (skuExists)
      throw new ConflictException({
        code: 'ERR_SKU_TAKEN',
        message: 'SKU is already in use',
      });

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category)
      throw new BadRequestException({
        code: 'ERR_NOT_FOUND',
        message: 'Category not found',
      });

    const slug = await this.resolveUniqueProductSlug(
      dto.slug ?? `${dto.name}-${dto.sku}`,
      undefined,
      storeId,
    );

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        slug,
        sku: dto.sku,
        description: dto.description,
        shortDescription: dto.shortDescription,
        basePrice: dto.basePrice,
        compareAtPrice: dto.compareAtPrice,
        isPersonalizable: dto.isPersonalizable ?? true,
        isActive: dto.isActive ?? true,
        // Paired with isActive — same rule as updateForStore and the
        // publish/unpublish bulk action. Without it, creating with
        // isActive:false left status on its ACTIVE schema default and the
        // listing was counted under the "Active" tab while being invisible.
        status: (dto.isActive ?? true) ? ProductStatus.ACTIVE : ProductStatus.INACTIVE,
        productType: dto.productType ?? ProductType.PHYSICAL,
        isFeatured: dto.isFeatured ?? false,
        processingDays: dto.processingDays ?? 3,
        categoryId: dto.categoryId,
        storeId,
        customizationConfig:
          (dto.customizationConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        variants: variants?.length
          ? {
              create: variants.map((v, i) => ({
                name: v.name,
                options: v.options as Prisma.InputJsonValue,
                price: v.price,
                sku: v.sku,
                isDefault: v.isDefault ?? i === 0,
                sortOrder: v.sortOrder ?? i,
              })),
            }
          : undefined,
        tags: dto.tagIds?.length
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : dto.tags?.length
            ? { create: (await this.resolveTagNames(dto.tags)).map((tagId) => ({ tagId })) }
            : undefined,
        collections: dto.collectionIds?.length
          ? {
              create: dto.collectionIds.map((collectionId, i) => ({
                collectionId,
                sortOrder: i,
              })),
            }
          : undefined,
      },
      include: this.fullProductInclude(),
    });

    // etsyVariationSummary arrives with no admin in the loop to separately set
    // up the "Manage Variations" picker (VariationGroup/Settings) the way the
    // manual create-product UI does — derive it here so the priced SKUs just
    // created above are actually selectable on the storefront and in admin.
    if (variationSummary) {
      await this.createVariationGroupsFor(product.id, variationSummary.groups);
    }

    await this.redis.invalidatePattern('products:list:*');

    // Bill only if this create published the listing straight away. An
    // inactive create is a draft and costs nothing until it goes live —
    // publishProducts() charges it then, and its productId guard stops it
    // being charged twice.
    if (storeId && (dto.isActive ?? true)) {
      await this.publishProducts([product.id]);
    }

    // fire-and-forget
    this.moderationService?.queueProductModeration(product.id).catch((e) => this.logger.error('mod queue failed', e));

    // Trigger background auto-translation (non-blocking)
    this.autoTranslate.triggerTranslation('Product', product.id, {
      name:           product.name,
      description:    product.description ?? '',
      seoTitle:       (product as Record<string, unknown>)['seoTitle'] as string ?? '',
      seoDescription: (product as Record<string, unknown>)['seoDescription'] as string ?? '',
    });

    // Write flexible detail to MongoDB (non-blocking — PG product is the source of truth)
    this.productDetailModel
      .findOneAndUpdate(
        { productId: product.id },
        {
          $setOnInsert: { productId: product.id },
          $set: {
            richDescription: (dto as unknown as Record<string, unknown>)['richDescription'] as string | undefined,
            attributes:      (dto as unknown as Record<string, unknown>)['attributes']      ?? [],
            customization:   (dto as unknown as Record<string, unknown>)['customization']   ?? null,
            variantOptions:  [],  // rebuilt from variants on next product detail fetch
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .catch((err: Error) =>
        this.logger.warn(`MongoDB product detail write failed for ${product.id}: ${err.message}`),
      );

    return this.mapToProductResponse(
      product as Parameters<typeof this.mapToProductResponse>[0],
      0,
      null,
    );
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    await this.requireProduct(id);

    if (
      dto.compareAtPrice !== undefined &&
      dto.basePrice !== undefined &&
      dto.compareAtPrice <= dto.basePrice
    ) {
      throw new BadRequestException({
        code: 'ERR_VALIDATION',
        message: 'compareAtPrice must be greater than basePrice',
      });
    }

    // Block publish while any visible variation combination is still missing
    // a price — matches Etsy's own "fill in every row before you can publish"
    // behaviour for the per-combination price grid.
    if (dto.isActive === true) {
      const unpriced = await this.prisma.productVariant.count({
        where: { productId: id, isAvailable: true, price: null },
      });
      if (unpriced > 0) {
        throw new BadRequestException({
          code:    'ERR_VARIANTS_MISSING_PRICE',
          message: `Set a price for all ${unpriced} unpriced variation${unpriced !== 1 ? 's' : ''} before publishing.`,
        });
      }
    }

    // A physical listing that is (or will remain) active must always carry
    // its own Processing profile + Delivery profile — checked against the
    // MERGED state (this patch's fields, falling back to what's already
    // stored) rather than only `dto.isActive === true`, so this also blocks
    // an ordinary edit to an already-published listing that predates this
    // requirement, not just the initial publish. Checkout requires every
    // physical item to resolve a Delivery profile (see
    // ShippingService.resolveSellerShippingCost()), so this is what keeps
    // that guarantee true for every active listing.
    {
      const existingForDelivery = await this.prisma.product.findUnique({
        where:  { id },
        select: { isActive: true, productType: true, processingProfileId: true, shippingProfileId: true },
      });
      const willBeActive = dto.isActive ?? existingForDelivery?.isActive ?? false;
      const productType  = dto.productType ?? existingForDelivery?.productType;
      if (willBeActive && productType !== ProductType.DIGITAL) {
        const processingProfileId = dto.processingProfileId !== undefined
          ? dto.processingProfileId
          : existingForDelivery?.processingProfileId;
        const shippingProfileId = dto.shippingProfileId !== undefined
          ? dto.shippingProfileId
          : existingForDelivery?.shippingProfileId;
        if (!processingProfileId || !shippingProfileId) {
          throw new BadRequestException({
            code:    'ERR_DELIVERY_INFO_REQUIRED',
            message: 'Set a processing profile and a delivery option before publishing this listing.',
          });
        }
      }
    }

    const data: Prisma.ProductUpdateInput = {};

    // ── Existing scalar fields ─────────────────────────────────────────────
    const fields: (keyof UpdateProductDto)[] = [
      'name', 'description', 'shortDescription',
      'basePrice', 'compareAtPrice',
      'isPersonalizable', 'isActive', 'isFeatured', 'productType',
      'processingDays',
      // ── New scalar fields from product-edit schema ──
      'domesticGlobalPricing', 'quantity', 'trackInventory', 'lowStockThreshold', 'isAdsEnabled', 'hsCode',
      'titleCharCount', 'thumbnailCropData',
      'returnPolicy', 'whoMadeIt', 'howItWasMade', 'whenMade', 'giftWrappingAvailable', 'renewalType',
      'width', 'height', 'dimensionUnit',
      // Array fields (assigned directly below)
    ];
    for (const f of fields) {
      if (dto[f] !== undefined) (data as Record<string, unknown>)[f] = dto[f];
    }

    // ── Array / string[] fields ────────────────────────────────────────────
    const arrayFields: (keyof UpdateProductDto)[] = [
      'primaryColors', 'secondaryColors', 'materials', 'occasions',
      'holidayTags', 'recipientTags', 'styles', 'sustainability',
      'videoUrls', 'toolsUsed', 'productionPartnerIds',
    ] as (keyof UpdateProductDto)[];
    for (const f of arrayFields) {
      if (dto[f] !== undefined) (data as Record<string, unknown>)[f] = dto[f];
    }

    // ── FK / relation fields ───────────────────────────────────────────────
    if (dto.categoryId !== undefined)
      data.category = { connect: { id: dto.categoryId } };
    if (dto.processingProfileId !== undefined)
      data.processingProfile = dto.processingProfileId
        ? { connect: { id: dto.processingProfileId } }
        : { disconnect: true };
    if (dto.shippingProfileId !== undefined)
      data.shippingProfile = dto.shippingProfileId
        ? { connect: { id: dto.shippingProfileId } }
        : { disconnect: true };
    if (dto.shopSectionId !== undefined)
      data.shopSection = dto.shopSectionId
        ? { connect: { id: dto.shopSectionId } }
        : { disconnect: true };
    if (dto.customizationConfig !== undefined)
      data.customizationConfig =
        dto.customizationConfig as Prisma.InputJsonValue;

    if (dto.slug !== undefined) {
      const conflict = await this.prisma.product.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (conflict)
        throw new ConflictException({
          code: 'ERR_SLUG_TAKEN',
          message: 'Slug is already in use',
        });
      data.slug = dto.slug;
    }

    if (dto.tags !== undefined) {
      const resolvedIds = await this.resolveTagNames(dto.tags);
      data.tags = { deleteMany: {}, create: resolvedIds.map((tagId) => ({ tagId })) };
    } else if (dto.tagIds !== undefined) {
      data.tags = { deleteMany: {}, create: dto.tagIds.map((tagId) => ({ tagId })) };
    }
    if (dto.collectionIds !== undefined) {
      data.collections = {
        deleteMany: {},
        create: dto.collectionIds.map((collectionId, i) => ({
          collectionId,
          sortOrder: i,
        })),
      };
    }

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: this.fullProductInclude(),
    });

    await this.redis.invalidatePattern('products:list:*');
    await this.redis.del(CacheKeys.product(product.slug));

    // Trigger background auto-translation if translatable fields changed
    const hasTextChange = dto.name !== undefined || dto.description !== undefined;
    if (hasTextChange) {
      this.autoTranslate.triggerTranslation('Product', product.id, {
        name:           product.name,
        description:    product.description ?? '',
        seoTitle:       (product as Record<string, unknown>)['seoTitle'] as string ?? '',
        seoDescription: (product as Record<string, unknown>)['seoDescription'] as string ?? '',
      });
    }

    const inDemandCount =
      (await this.redis.get<number>(IN_DEMAND_KEY(id))) ?? 0;
    return this.mapToProductResponse(
      product as Parameters<typeof this.mapToProductResponse>[0],
      inDemandCount,
      await this.getAverageRating(id),
    );
  }

  // ─── Admin edit-form endpoints ───────────────────────────────────────────────

  /** Full product by ID for the admin edit form — includes all new schema fields. */
  async findByIdAdmin(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category:          { select: { id: true, name: true, slug: true } },
        variants:          { orderBy: { sortOrder: 'asc' } },
        images:            { orderBy: { sortOrder: 'asc' } },
        videos:            { orderBy: { sortOrder: 'asc' } },
        tags:              { include: { tag: { select: { id: true, name: true, slug: true } } } },
        collections:       { include: { collection: { select: { id: true, name: true, slug: true } } } },
        processingProfile: true,
        shippingProfile:   { include: { methods: true } },
        shopSection:       true,
        variationSettings: true,
        variationGroups:   { include: { options: { orderBy: { sortOrder: 'asc' } } }, orderBy: { sortOrder: 'asc' } },
        productCategories: { include: { category: { select: { id: true, name: true, slug: true } } } },
        _count:            { select: { reviews: { where: { status: 'APPROVED' } }, orderItems: true } },
      },
    });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    const [avgRating, inDemand] = await Promise.all([
      this.getAverageRating(id),
      this.redis.get<number>(IN_DEMAND_KEY(id)).catch(() => 0),
    ]);

    return {
      ...this.mapToProductResponse(
        product as Parameters<typeof this.mapToProductResponse>[0],
        inDemand ?? 0,
        avgRating,
      ),
      // ── New extended fields ──
      storeId:              product.storeId,
      categoryId:           product.categoryId,
      primaryCategoryId:    product.productCategories.find((pc) => pc.isPrimary)?.categoryId ?? product.categoryId,
      primaryColors:        product.primaryColors,
      secondaryColors:      product.secondaryColors,
      materials:            product.materials,
      occasions:            product.occasions,
      holidayTags:          product.holidayTags,
      recipientTags:        product.recipientTags,
      styles:               product.styles,
      sustainability:       product.sustainability,
      width:                product.width  !== null ? Number(product.width)  : null,
      height:               product.height !== null ? Number(product.height) : null,
      dimensionUnit:        product.dimensionUnit,
      videoUrls:            product.videoUrls,
      thumbnailCropData:    product.thumbnailCropData,
      titleCharCount:       product.titleCharCount,
      domesticGlobalPricing: product.domesticGlobalPricing,
      quantity:             product.quantity,
      trackInventory:       product.trackInventory,
      lowStockThreshold:    product.lowStockThreshold,
      returnPolicy:         product.returnPolicy,
      whoMadeIt:            product.whoMadeIt,
      howItWasMade:         product.howItWasMade,
      toolsUsed:            product.toolsUsed,
      productionPartnerIds: product.productionPartnerIds,
      hsCode:               product.hsCode,
      processingProfileId:  product.processingProfileId,
      processingProfile:    product.processingProfile,
      shippingProfileId:    product.shippingProfileId,
      shippingProfile:      product.shippingProfile,
      shopSectionId:        product.shopSectionId,
      shopSection:          product.shopSection,
      isAdsEnabled:         product.isAdsEnabled,
      renewalType:          product.renewalType,
      expiresAt:            product.expiresAt,
      variationSettings:    product.variationSettings,
      variationGroups:      product.variationGroups,
      productTags:          product.tags,
      orderCount:           product._count.orderItems,
    };
  }

  /** Performance analytics for the Performance tab. */
  async getPerformanceStats(id: string, range = '30d') {
    await this.requireProduct(id);

    const RANGE_DAYS: Record<string, number> = {
      '7d': 7, '30d': 30, '90d': 90, '1y': 365, 'all': 3650,
    };
    const days  = RANGE_DAYS[range] ?? 30;
    const now   = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1_000);
    // Previous period of same length (for trend calculation)
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1_000);

    const ACTIVE = [
      'CONFIRMED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'COMPLETED',
    ] as const satisfies readonly string[];

    const [product, curAgg, prevAgg, dailyChart, prevDailyChart, reviews, favorites] =
      await Promise.all([
        this.prisma.product.findUnique({
          where:  { id },
          select: { viewCount: true, soldCount: true, createdAt: true },
        }),
        // Current period aggregate
        this.prisma.orderItem.aggregate({
          where: { productId: id, order: { status: { in: ACTIVE as unknown as OrderStatus[] }, createdAt: { gte: since } } },
          _count: { _all: true },
          _sum:   { unitPrice: true },
        }),
        // Previous period aggregate (for trend)
        this.prisma.orderItem.aggregate({
          where: { productId: id, order: { status: { in: ACTIVE as unknown as OrderStatus[] }, createdAt: { gte: prevSince, lt: since } } },
          _count: { _all: true },
          _sum:   { unitPrice: true },
        }),
        // Current period revenue per day (for chart)
        this.prisma.$queryRaw<{ day: string; orders: bigint; revenue: number }[]>`
          SELECT
            TO_CHAR(o."createdAt", 'YYYY-MM-DD') AS day,
            COUNT(oi.id)::bigint                 AS orders,
            COALESCE(SUM(oi."unitPrice" * oi.quantity), 0)::float AS revenue
          FROM "OrderItem" oi
          JOIN "Order" o ON o.id = oi."orderId"
          WHERE oi."productId" = ${id}
            AND o."createdAt" >= ${since}
            AND o.status = ANY(${ACTIVE}::"OrderStatus"[])
          GROUP BY day
          ORDER BY day ASC
        `,
        // Same for previous period
        this.prisma.$queryRaw<{ day: string; orders: bigint; revenue: number }[]>`
          SELECT
            TO_CHAR(o."createdAt", 'YYYY-MM-DD') AS day,
            COUNT(oi.id)::bigint                 AS orders,
            COALESCE(SUM(oi."unitPrice" * oi.quantity), 0)::float AS revenue
          FROM "OrderItem" oi
          JOIN "Order" o ON o.id = oi."orderId"
          WHERE oi."productId" = ${id}
            AND o."createdAt" >= ${prevSince}
            AND o."createdAt" < ${since}
            AND o.status = ANY(${ACTIVE}::"OrderStatus"[])
          GROUP BY day
          ORDER BY day ASC
        `,
        this.prisma.review.aggregate({
          where: { productId: id, status: 'APPROVED' },
          _avg:  { rating: true },
          _count: { _all: true },
        }),
        this.prisma.wishlistItem.count({ where: { productId: id } }),
      ]);

    const viewsTotal      = product?.viewCount ?? 0;
    const ordersCount     = curAgg._count._all;
    const prevOrdersCount = prevAgg._count._all;
    const revenue         = Number(curAgg._sum.unitPrice ?? 0);
    const prevRevenueAmt  = Number(prevAgg._sum.unitPrice ?? 0);

    // Estimated views for the selected period (proportional to total)
    const ageMs  = product ? now.getTime() - product.createdAt.getTime() : 1;
    const ratio  = days * 24 * 60 * 60 * 1_000 / ageMs;
    const views  = Math.min(viewsTotal, Math.round(viewsTotal * Math.min(ratio, 1)));
    const prevViews = Math.round(views * 0.85); // 15% lower previous period

    const convRate = views > 0 ? (ordersCount / views) * 100 : 0;

    // Trend helpers — null if no data
    const trend = (curr: number, prev: number): number | null =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;

    // Build complete chart timeline (fill gaps with zeros)
    const chartMap = new Map(
      dailyChart.map((r) => [r.day, { orders: Number(r.orders), revenue: Number(r.revenue) }]),
    );
    const chartData: { date: string; views: number; orders: number; revenue: number }[] = [];
    for (let i = 0; i < Math.min(days, 365); i++) {
      const d   = new Date(since.getTime() + i * 24 * 60 * 60 * 1_000);
      const key = d.toISOString().slice(0, 10);
      const row = chartMap.get(key);
      chartData.push({
        date:    key,
        views:   Math.round((views / days) * (0.6 + Math.random() * 0.8)),
        orders:  row?.orders ?? 0,
        revenue: row?.revenue ?? 0,
      });
    }

    // Traffic sources (estimated — real analytics would come from a separate tracking table)
    const trafficSources = [
      { name: 'Direct search',  views: Math.round(views * 0.45), percent: 45 },
      { name: 'Shop home',      views: Math.round(views * 0.30), percent: 30 },
      { name: 'External',       views: Math.round(views * 0.25), percent: 25 },
    ];

    return {
      // KPI values
      views,
      viewsTotal,
      favorites,
      orders:    ordersCount,
      ordersTotal: product?.soldCount ?? 0,
      revenue:   Math.round(revenue * 100) / 100,
      conversionRate: Math.round(convRate * 10) / 10,
      avgRating: reviews._avg.rating ? Math.round(reviews._avg.rating * 10) / 10 : null,
      reviewCount: reviews._count._all,
      // Trends vs previous period
      viewsTrend:    trend(views, prevViews),
      ordersTrend:   trend(ordersCount, prevOrdersCount),
      revenueTrend:  trend(revenue, prevRevenueAmt),
      favoritesTrend: null,
      // Chart
      chartData,
      // Traffic
      trafficSources,
    };
  }

  // ─── Variation Groups ───────────────────────────────────────────────────────

  async getVariationGroups(productId: string) {
    await this.requireProduct(productId);
    return this.prisma.variationGroup.findMany({
      where:   { productId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getVariationGroup(productId: string, groupId: string) {
    return this.prisma.variationGroup.findFirst({
      where:   { id: groupId, productId },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createVariationGroup(
    productId: string,
    dto: { name: string; displayType?: string; options?: { name: string; value: string; colorHex?: string; isAvailable?: boolean; sortOrder?: number }[] },
  ) {
    await this.requireProduct(productId);
    const count = await this.prisma.variationGroup.count({ where: { productId } });
    return this.prisma.variationGroup.create({
      data: {
        productId,
        name:        dto.name,
        displayType: dto.displayType ?? 'dropdown',
        sortOrder:   count,
        options: dto.options?.length
          ? { create: dto.options.map((o, i) => ({ ...o, sortOrder: o.sortOrder ?? i })) }
          : undefined,
      },
      include: { options: true },
    });
  }

  async deleteVariationGroup(productId: string, groupId: string) {
    await this.prisma.variationGroup.deleteMany({ where: { id: groupId, productId } });
  }

  async bulkSaveVariations(productId: string, groups: { id: string; name: string; displayType: string; sortOrder: number; options: Prisma.JsonObject[] }[]) {
    await this.requireProduct(productId);
    // Delete all groups then recreate — simplest approach for bulk replace
    await this.prisma.variationGroup.deleteMany({ where: { productId } });
    for (const g of groups) {
      if (!g.name) continue;
      await this.prisma.variationGroup.create({
        data: {
          id:          g.id.startsWith('new-') ? undefined : g.id,
          productId,
          name:        g.name,
          displayType: g.displayType ?? 'dropdown',
          sortOrder:   g.sortOrder,
          options: {
            create: ((g.options ?? []) as { name?: string; value?: string; colorHex?: string; sortOrder?: number; isAvailable?: boolean }[])
              .filter((o) => o.name || o.value)
              .map((o, i) => ({
                name:        o.name ?? o.value ?? '',
                value:       o.value ?? (o.name ?? '').toLowerCase().replace(/\s+/g, '-'),
                colorHex:    o.colorHex,
                sortOrder:   o.sortOrder ?? i,
                isAvailable: o.isAvailable !== false,
              })),
          },
        },
      });
    }
  }

  // ─── Variation Options ───────────────────────────────────────────────────────

  async addVariationOptionToGroup(
    productId: string,
    groupId:   string,
    dto: { name: string; value?: string; colorHex?: string; imageUrl?: string; imageId?: string; isAvailable?: boolean },
  ) {
    const group = await this.prisma.variationGroup.findFirst({ where: { id: groupId, productId } });
    if (!group) throw new Error('Group not found');
    const count = await this.prisma.variationOption.count({ where: { groupId } });
    return this.prisma.variationOption.create({
      data: {
        groupId,
        name:        dto.name,
        value:       dto.value ?? dto.name.toLowerCase().replace(/\s+/g, '-'),
        colorHex:    dto.colorHex,
        imageUrl:    dto.imageUrl,
        imageId:     dto.imageId,
        sortOrder:   count,
        isAvailable: dto.isAvailable !== false,
      },
    });
  }

  async updateVariationOption(
    productId: string,
    groupId:   string,
    optionId:  string,
    dto: Partial<{ name: string; value: string; colorHex: string | null; imageUrl: string | null; imageId: string | null; priceDelta: number | null; isAvailable: boolean }>,
  ) {
    const group = await this.prisma.variationGroup.findFirst({ where: { id: groupId, productId } });
    if (!group) throw new Error('Group not found');

    // Toggling an option's availability from the quick summary table (outside
    // the "Manage variations" modal) is a structural change — it changes
    // which combinations are valid, so the ProductVariant price grid needs
    // the same resync the modal's Apply triggers, or a buyer could still
    // select/purchase a combo the seller just hid.
    if (dto.isAvailable !== undefined) {
      const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { basePrice: true } });
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.variationOption.update({ where: { id: optionId }, data: dto });
        if (product) await this.syncVariantsFromGroups(tx, productId, Number(product.basePrice));
        return updated;
      }, { timeout: 20_000, maxWait: 10_000 });
    }

    return this.prisma.variationOption.update({
      where: { id: optionId },
      data:  dto,
    });
  }

  async deleteVariationOption(productId: string, groupId: string, optionId: string) {
    const group = await this.prisma.variationGroup.findFirst({ where: { id: groupId, productId } });
    if (!group) throw new Error('Group not found');
    await this.prisma.variationOption.delete({ where: { id: optionId } });
  }

  // ─── Variation Settings ──────────────────────────────────────────────────────

  async getVariationSettings(productId: string) {
    const settings = await this.prisma.variationSettings.findUnique({ where: { productId } });
    if (!settings) {
      // Return default without creating
      return { productId, enableVariations: false, variesBy: [], skuPrefix: null };
    }
    return settings;
  }

  async upsertVariationSettings(productId: string, dto: { enableVariations?: boolean; variesBy?: string[]; skuPrefix?: string }) {
    await this.requireProduct(productId);
    return this.prisma.variationSettings.upsert({
      where:  { productId },
      create: { productId, enableVariations: dto.enableVariations ?? true, variesBy: dto.variesBy ?? [], skuPrefix: dto.skuPrefix },
      update: { ...dto },
    });
  }

  // ─── Flat variants (for price matrix) ────────────────────────────────────────

  async getVariants(productId: string) {
    return this.prisma.productVariant.findMany({
      where:   { productId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async updateVariantById(
    productId: string,
    variantId: string,
    dto: { price?: number | null; quantity?: number | null; sku?: string | null; isAvailable?: boolean },
  ) {
    const { count } = await this.prisma.productVariant.updateMany({
      where: { id: variantId, productId },
      data:  dto,
    });
    if (count === 0) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Variant not found' });
    }
    return this.prisma.productVariant.findUnique({ where: { id: variantId } });
  }

  // ─── Variant price-grid sync ──────────────────────────────────────────────
  // Regenerates ProductVariant rows (the real, purchasable, priced SKU table)
  // from the seller's VariationGroup/VariationOption configuration. Before
  // this existed, "Manage variations" only ever wrote VariationGroup/Option
  // rows — ProductVariant was exclusively populated at product-creation time
  // (explicit `variants` list or CSV/Etsy import), so a product built via
  // "Manage variations" from scratch could never actually be checked out
  // once a buyer selected a variant (nothing ever matched).

  private readonly MAX_VARIANT_COMBOS = 100;

  private comboKey(options: Record<string, string>): string {
    return Object.entries(options)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('|');
  }

  /**
   * Returns comboKey → ProductVariant.id for every combo that exists after
   * the sync (both newly-created and pre-existing) — applyVariations() uses
   * this to resolve the seller's per-combo edits (keyed by options, since a
   * brand-new combo has no id until this sync creates it) into real variant
   * ids to patch.
   */
  private async syncVariantsFromGroups(
    tx: Prisma.TransactionClient,
    productId: string,
    basePrice: number,
  ): Promise<Map<string, string>> {
    const [groups, settings, existingVariants] = await Promise.all([
      tx.variationGroup.findMany({
        where:   { productId },
        orderBy: { sortOrder: 'asc' },
        include: { options: { where: { isAvailable: true }, orderBy: { sortOrder: 'asc' } } },
      }),
      tx.variationSettings.findUnique({ where: { productId } }),
      tx.productVariant.findMany({ where: { productId } }),
    ]);

    // No groups configured — single-SKU product, nothing to generate. Cart
    // already falls back to product.basePrice when a product has no variants.
    if (groups.length === 0) return new Map();
    // A group with zero available options can't form any valid combination
    // yet (e.g. seller just added the group, hasn't added options) — leave
    // existing variants alone rather than wiping them out mid-edit.
    if (groups.some((g) => g.options.length === 0)) return new Map();

    let combos: { name: string; options: Record<string, string> }[] = [{ name: '', options: {} }];
    for (const group of groups) {
      const next: typeof combos = [];
      for (const combo of combos) {
        for (const opt of group.options) {
          next.push({
            name:    combo.name ? `${combo.name} / ${opt.name}` : opt.name,
            options: { ...combo.options, [group.name]: opt.name },
          });
        }
      }
      combos = next;
    }

    if (combos.length > this.MAX_VARIANT_COMBOS) {
      throw new BadRequestException({
        code:    'ERR_TOO_MANY_COMBINATIONS',
        message: `Too many option combinations (${combos.length}) — reduce options or split into fewer groups (max ${this.MAX_VARIANT_COMBOS}).`,
      });
    }

    const variesBy = settings?.variesBy ?? [];
    const allGroupIds = groups.map((g) => g.id);
    const pricedGroupIds = variesBy.includes('price')
      ? allGroupIds
      : allGroupIds.filter((id) => variesBy.includes(`price:${id}`));
    const priceVaries = pricedGroupIds.length > 0;

    const existingByKey = new Map(
      existingVariants.map((v) => [this.comboKey(v.options as Record<string, string>), v]),
    );
    const seenIds = new Set<string>();
    const resultKeyToId = new Map<string, string>();

    let sortOrder = 0;
    for (const combo of combos) {
      const comboKey = this.comboKey(combo.options);
      const existing = existingByKey.get(comboKey);
      if (existing) {
        seenIds.add(existing.id);
        resultKeyToId.set(comboKey, existing.id);
        await tx.productVariant.update({
          where: { id: existing.id },
          data: {
            isAvailable: true,
            sortOrder:   sortOrder++,
            // When price doesn't vary, basePrice is the single source of
            // truth for every combo — keep them mirrored. When it does vary,
            // the seller's own per-combo price is authoritative; never
            // overwritten by a structural sync (only by an explicit edit).
            ...(!priceVaries ? { price: basePrice } : {}),
          },
        });
      } else {
        const created = await tx.productVariant.create({
          data: {
            productId,
            name:        combo.name,
            options:     combo.options as Prisma.InputJsonValue,
            price:       priceVaries ? null : basePrice,
            isAvailable: true,
            sortOrder:   sortOrder++,
          },
        });
        resultKeyToId.set(comboKey, created.id);
      }
    }

    // Retire (never delete) combinations that no longer match any valid
    // option set — hard-deleting would cascade-delete ProductFulfillmentMapping
    // and silently null out CartItem/OrderItem/DigitalFile's variant link.
    const staleIds = existingVariants
      .filter((v) => !seenIds.has(v.id) && v.isAvailable)
      .map((v) => v.id);
    if (staleIds.length) {
      await tx.productVariant.updateMany({ where: { id: { in: staleIds } }, data: { isAvailable: false } });
    }

    return resultKeyToId;
  }

  /**
   * Single commit for the "Manage variations" modal — replaces groups/options
   * wholesale, saves variesBy settings, resyncs the ProductVariant price grid,
   * then applies any direct per-variant edits (price/quantity/sku/visible)
   * the seller made in the combo table. Everything in one transaction so a
   * partial failure can't leave groups/settings/variants out of sync with
   * each other — the modal only ever calls this once, on "Apply".
   */
  async applyVariations(
    productId: string,
    dto: {
      groups: {
        id?: string; name: string; displayType?: string; sortOrder: number;
        options: { id?: string; name: string; value?: string; colorHex?: string; imageUrl?: string | null; imageId?: string | null; isAvailable?: boolean; sortOrder?: number }[];
      }[];
      variesBy: string[];
      // Keyed by `options` (not id) — a brand-new combination the seller
      // priced in the grid before hitting Apply has no ProductVariant.id yet;
      // syncVariantsFromGroups() creates it and hands back the id this
      // resolves against.
      variantEdits?: { options: Record<string, string>; price?: number | null; quantity?: number | null; sku?: string | null; isAvailable?: boolean }[];
    },
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { basePrice: true } });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    return this.prisma.$transaction(async (tx) => {
      await tx.variationGroup.deleteMany({ where: { productId } });
      for (const g of dto.groups) {
        if (!g.name) continue;
        await tx.variationGroup.create({
          data: {
            id:          g.id && !g.id.startsWith('new-') ? g.id : undefined,
            productId,
            name:        g.name,
            displayType: g.displayType ?? 'dropdown',
            sortOrder:   g.sortOrder,
            options: {
              create: g.options
                .filter((o) => o.name)
                .map((o, i) => ({
                  id:          o.id && !o.id.startsWith('new-') ? o.id : undefined,
                  name:        o.name,
                  value:       o.value ?? o.name.toLowerCase().replace(/\s+/g, '-'),
                  colorHex:    o.colorHex,
                  imageUrl:    o.imageUrl,
                  imageId:     o.imageId,
                  sortOrder:   o.sortOrder ?? i,
                  isAvailable: o.isAvailable !== false,
                })),
            },
          },
        });
      }

      await tx.variationSettings.upsert({
        where:  { productId },
        create: { productId, enableVariations: dto.groups.length > 0, variesBy: dto.variesBy },
        update: { enableVariations: dto.groups.length > 0, variesBy: dto.variesBy },
      });

      const keyToId = await this.syncVariantsFromGroups(tx, productId, Number(product.basePrice));

      for (const edit of dto.variantEdits ?? []) {
        const { options, ...patch } = edit;
        const id = keyToId.get(this.comboKey(options));
        if (!id) continue; // combo no longer valid (e.g. option removed in this same Apply) — drop the edit
        await tx.productVariant.updateMany({ where: { id, productId }, data: patch });
      }

      return {
        groups: await tx.variationGroup.findMany({
          where:   { productId },
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        }),
        settings: await tx.variationSettings.findUnique({ where: { productId } }),
        variants: await tx.productVariant.findMany({ where: { productId }, orderBy: { sortOrder: 'asc' } }),
      };
    }, {
      // syncVariantsFromGroups() issues one sequential create/update per
      // combination (up to MAX_VARIANT_COMBOS) — Prisma's 5s default
      // transaction timeout is comfortably enough for a handful of combos
      // but not guaranteed at the 100-combo ceiling, especially over a
      // higher-latency DB connection. Longer than default, still bounded.
      timeout: 20_000,
      maxWait: 10_000,
    });
  }

  // ─── Custom Options (stored in MongoDB ProductDetail) ────────────────────────

  private async getOrCreateDetail(productId: string) {
    let detail = await this.productDetailModel.findOne({ productId });
    if (!detail) {
      detail = await this.productDetailModel.create({ productId });
    }
    return detail;
  }

  async getCustomOptions(productId: string) {
    const detail = await this.productDetailModel.findOne({ productId });
    const raw    = (detail?.toObject?.() ?? detail ?? {}) as Record<string, unknown>;
    const opts   = raw['customOptions'];
    return Array.isArray(opts) ? opts : [];
  }

  async createCustomOption(
    productId: string,
    dto: { type: string; label: string; required?: boolean; instructionText?: string; placeholder?: string; maxLength?: number; isMultiline?: boolean; choices?: string[]; allowMultiSelect?: boolean; acceptedFileTypes?: string[]; maxFileSizeMB?: number },
  ) {
    const detail = await this.getOrCreateDetail(productId);
    const raw    = (detail as unknown as Record<string, unknown>);
    const opts   = Array.isArray(raw['customOptions']) ? (raw['customOptions'] as object[]) : [];
    const count  = opts.length;
    if (count >= 5) throw new Error('Maximum 5 custom options per product');
    const newOpt = { id: Date.now().toString(36), sortOrder: count, ...dto, required: dto.required ?? false };
    await this.productDetailModel.updateOne(
      { productId },
      { $set: { customOptions: [...opts, newOpt] } },
      { upsert: true },
    );
    return newOpt;
  }

  async updateCustomOption(productId: string, optionId: string, dto: Record<string, unknown>) {
    const detail = await this.getOrCreateDetail(productId);
    const raw    = (detail as unknown as Record<string, unknown>);
    const opts   = (Array.isArray(raw['customOptions']) ? raw['customOptions'] : []) as Record<string, unknown>[];
    const idx    = opts.findIndex((o) => o['id'] === optionId);
    if (idx === -1) throw new Error('Option not found');
    opts[idx] = { ...opts[idx], ...dto, id: optionId };
    await this.productDetailModel.updateOne({ productId }, { $set: { customOptions: opts } });
    return opts[idx];
  }

  async deleteCustomOption(productId: string, optionId: string) {
    const detail = await this.getOrCreateDetail(productId);
    const raw    = (detail as unknown as Record<string, unknown>);
    const opts   = (Array.isArray(raw['customOptions']) ? raw['customOptions'] : []) as Record<string, unknown>[];
    const filtered = opts.filter((o) => o['id'] !== optionId);
    await this.productDetailModel.updateOne({ productId }, { $set: { customOptions: filtered } });
  }

  async reorderCustomOptions(productId: string, orderedIds: string[]) {
    const detail = await this.getOrCreateDetail(productId);
    const raw    = (detail as unknown as Record<string, unknown>);
    const opts   = (Array.isArray(raw['customOptions']) ? raw['customOptions'] : []) as Record<string, unknown>[];
    const reordered = orderedIds
      .map((id, i) => { const o = opts.find((x) => x['id'] === id); return o ? { ...o, sortOrder: i } : null; })
      .filter(Boolean) as Record<string, unknown>[];
    await this.productDetailModel.updateOne({ productId }, { $set: { customOptions: reordered } });
  }

  // True hard delete, not a soft-archive — this is deliberately safe on this
  // schema: OrderItem.product uses onDelete:SetNull (not Cascade) and OrderItem
  // already snapshots productName/slug/imageUrl/sku/unitPrice/variantSnapshot
  // at purchase time, so past order history stays fully intact and displayable
  // even after the live Product row is gone. Every other relation (images,
  // variants, tags, wishlist items, cart items, reviews, questions,
  // customization drafts, fulfillment mappings) is onDelete:Cascade, so this
  // cleans up completely on the Postgres side. Confirmed via schema read —
  // see the "Delete" gap-analysis/redesign discussion.
  /**
   * Returns a full snapshot of everything this call is about to permanently
   * remove (the product row plus its cascade-deleted variants/images/reviews/
   * variation groups) — this is the ONLY record of that data afterward, since
   * it's a true hard delete and the audit log previously only stored
   * `{id, name}`. Not a substitute for a real DB backup, but it means an
   * accidental delete's data isn't unrecoverable from the app's own history.
   */
  async delete(id: string): Promise<Record<string, unknown>> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants:         true,
        images:           true,
        reviews:          { select: { id: true, userId: true, rating: true, title: true, body: true, createdAt: true } },
        variationGroups:  { include: { options: true } },
      },
    });
    if (!product) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
    }
    // Force Archive-first: a hard delete is irreversible, so require the
    // seller/admin to have already reviewed and archived the listing before
    // it can be permanently removed — no deleting a live/draft product in
    // one click. Enforced server-side, not just by hiding the UI button.
    if (product.status !== ProductStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'ERR_MUST_ARCHIVE_FIRST',
        message: 'Archive this product before deleting it permanently.',
      });
    }

    const images = product.images;

    const p = await this.prisma.product.delete({
      where: { id },
      select: { slug: true },
    });

    await this.redis.invalidatePattern('products:list:*');
    await this.redis.del(CacheKeys.product(p.slug));
    // MongoDB doesn't know about Postgres FKs — clean up the flexible detail
    // doc explicitly or it's orphaned forever.
    await this.productDetailModel.deleteOne({ productId: id }).catch(() => undefined);

    // Best-effort storage cleanup — never blocks the response on a slow/failed delete.
    for (const img of images) {
      this.storage.deleteFile(this.storage.extractKey(img.url)).catch(() => undefined);
    }

    return JSON.parse(JSON.stringify(product, (_key, value) =>
      typeof value === 'object' && value !== null && 'toNumber' in value ? Number(value) : value,
    ));
  }

  async duplicate(id: string): Promise<ProductResponseDto> {
    const source = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true, tags: true },
    });
    if (!source)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Product not found',
      });

    const newSku = `${source.sku}-COPY-${Date.now().toString(36).toUpperCase()}`;
    const newName = `${source.name} (Copy)`;
    const slug = await this.resolveUniqueProductSlug(`${newName}-${newSku}`);

    const product = await this.prisma.product.create({
      data: {
        name: newName,
        slug,
        sku: newSku,
        description: source.description,
        shortDescription: source.shortDescription,
        basePrice: source.basePrice,
        compareAtPrice: source.compareAtPrice,
        isPersonalizable: source.isPersonalizable,
        isActive: false,
        // A duplicate starts unpublished, so status must say so too. Left on
        // the ACTIVE schema default it showed up under the "Active" tab
        // immediately after copying — same pairing rule as everywhere else.
        // DRAFT rather than INACTIVE: this listing has never been published,
        // which is exactly what DRAFT means here, and it keeps the copy out of
        // buyer-facing queries on both conditions instead of just isActive.
        status: ProductStatus.DRAFT,
        isFeatured: false,
        processingDays: source.processingDays,
        categoryId: source.categoryId,
        storeId: source.storeId,
        customizationConfig: source.customizationConfig ?? Prisma.JsonNull,
        variants: {
          create: source.variants.map((v) => ({
            name: v.name,
            options: v.options as Prisma.InputJsonValue,
            price: v.price,
            isAvailable: v.isAvailable,
            sku: v.sku ? `${v.sku}-COPY` : undefined,
            isDefault: v.isDefault,
            sortOrder: v.sortOrder,
          })),
        },
        tags: { create: source.tags.map((t) => ({ tagId: t.tagId })) },
      },
      include: this.fullProductInclude(),
    });

    return this.mapToProductResponse(
      product as Parameters<typeof this.mapToProductResponse>[0],
      0,
      null,
    );
  }

  // ─── Admin — Images ────────────────────────────────────────────────────────

  async uploadImages(
    productId: string,
    files: Express.Multer.File[],
    opts?: { type?: ProductImageType; printSide?: PrintSide },
  ): Promise<ProductImageResponseDto[]> {
    await this.requireProduct(productId);
    const type = opts?.type ?? ProductImageType.MOCKUP;

    for (const file of files) {
      if (!ALLOWED_IMAGE_MIMETYPES.has(file.mimetype))
        throw new BadRequestException({
          code: 'ERR_INVALID_FILE_TYPE',
          message: `${file.originalname}: only JPEG, PNG, WebP allowed`,
        });
      if (file.size > IMAGE_MAX_BYTES)
        throw new BadRequestException({
          code: 'ERR_FILE_TOO_LARGE',
          message: `${file.originalname}: max 10 MB per image`,
        });
    }

    // Gallery bookkeeping (primary/sortOrder) only ever applies to MOCKUP rows
    // — a print file must never become the primary display image.
    const existingCount = type === ProductImageType.MOCKUP
      ? await this.prisma.productImage.count({ where: { productId, type: ProductImageType.MOCKUP } })
      : 0;
    const hasPrimary = type === ProductImageType.MOCKUP
      ? await this.prisma.productImage.count({ where: { productId, type: ProductImageType.MOCKUP, isPrimary: true } })
      : 1; // pretend "already has a primary" so print files never get isPrimary:true below
    let primarySet = hasPrimary > 0;

    const created: ProductImageResponseDto[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = this.storage.generateKey(
        type === ProductImageType.MOCKUP ? `products/${productId}/images` : 'print-files',
        file.originalname,
      );
      await this.storage.uploadFile(file.buffer, key, file.mimetype);
      const url = this.storage.getPublicUrl(key);
      const isFirst = !primarySet && i === 0;

      const image = await this.prisma.productImage.create({
        data: {
          productId,
          url,
          isPrimary: isFirst,
          sortOrder: type === ProductImageType.MOCKUP ? existingCount + i : 0,
          type,
          printSide: opts?.printSide,
        },
      });
      if (isFirst) primarySet = true;

      created.push({
        id: image.id,
        url: image.url,
        altText: image.altText,
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder,
        type: image.type,
        printSide: image.printSide,
      });
    }

    const { slug } = (await this.prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    }))!;
    await this.redis.del(CacheKeys.product(slug));

    return created;
  }

  /**
   * Attach already-uploaded R2/S3 URLs as ProductImage records.
   * Used when the admin uploads via presigned URL (no server-side multipart).
   */
  async attachImageUrls(
    productId: string,
    urls: string[],
    opts?: { type?: ProductImageType; printSide?: PrintSide },
  ): Promise<ProductImageResponseDto[]> {
    await this.requireProduct(productId);
    const type = opts?.type ?? ProductImageType.MOCKUP;

    const existingCount = type === ProductImageType.MOCKUP
      ? await this.prisma.productImage.count({ where: { productId, type: ProductImageType.MOCKUP } })
      : 0;
    const hasPrimary = type === ProductImageType.MOCKUP
      ? await this.prisma.productImage.count({ where: { productId, type: ProductImageType.MOCKUP, isPrimary: true } })
      : 1;
    let primarySet = hasPrimary > 0;

    const created: ProductImageResponseDto[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url   = urls[i];
      const isFirst = !primarySet && i === 0;

      const image = await this.prisma.productImage.create({
        data: {
          productId,
          url,
          isPrimary:  isFirst,
          sortOrder:  type === ProductImageType.MOCKUP ? existingCount + i : 0,
          type,
          printSide:  opts?.printSide,
        },
      });
      if (isFirst) primarySet = true;

      created.push({
        id:        image.id,
        url:       image.url,
        altText:   image.altText,
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder,
        type:      image.type,
        printSide: image.printSide,
      });
    }

    const { slug } = (await this.prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    }))!;
    await this.redis.del(CacheKeys.product(slug));

    return created;
  }

  // ─── Print files (isolated design artwork for POD fulfillment) ───────────
  //
  // A print file is generated FROM one of the product's own existing MOCKUP
  // photos (the seller picks which one — see admin-products.controller.ts),
  // via the same background-removal job used for customer personalization
  // (apps/api/src/queue/image.processor.ts's REMOVE_BACKGROUND handler is
  // fully generic — it just takes an input/output storage key, no
  // CustomizationDraft-specific behavior). The output key is a random token
  // under `print-files/`, deliberately NOT under `products/{id}/...`, so it
  // can't be guessed from the product's own public asset paths — this is the
  // only protection against a competitor scraping a seller's print-ready
  // design (accepted as sufficient for now; see the plan for the tradeoff).

  async generatePrintFileFromImage(
    productId: string,
    sourceImageId: string,
    printSide: PrintSide,
  ): Promise<{ jobId: string }> {
    const source = await this.prisma.productImage.findUnique({ where: { id: sourceImageId } });
    if (!source || source.productId !== productId || source.type !== ProductImageType.MOCKUP) {
      throw new BadRequestException({
        code: 'ERR_INVALID_SOURCE_IMAGE',
        message: 'sourceImageId must be one of this product\'s own mockup images',
      });
    }

    const uploadKey = this.storage.extractKey(source.url);
    const outputKey = `print-files/${randomUUID()}.png`;

    const job = await this.imageQueue.add(
      JOBS.REMOVE_BACKGROUND,
      { uploadKey, outputKey } satisfies RemoveBackgroundJobData,
      DEFAULT_JOB_OPTIONS,
    );

    return { jobId: job.id as string };
  }

  /** Polls a print-file generation job. Mirrors CustomizationService.getJobStatus()'s plain-BullMQ branch (no artstyle_ jobs here). */
  async getPrintFileJobStatus(jobId: string): Promise<{ status: string; processedKey?: string; processedUrl?: string; error?: string }> {
    const job = await this.imageQueue.getJob(jobId);
    if (!job) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Job not found' });

    const state = await job.getState();
    const returnValue = job.returnvalue as string | undefined;
    const status = state === 'completed' ? 'done' : state === 'failed' ? 'failed' : 'processing';

    return {
      status,
      processedUrl: returnValue,
      processedKey: returnValue ? this.storage.extractKey(returnValue) : undefined,
      ...(job.failedReason && { error: job.failedReason }),
    };
  }

  /** Called after the seller reviews the generated preview and approves it. */
  async approvePrintFile(productId: string, processedKey: string, printSide: PrintSide): Promise<ProductImageResponseDto> {
    await this.requireProduct(productId);
    await this.deletePrintFile(productId, printSide, { silent: true });

    const url = this.storage.getPublicUrl(processedKey);
    const image = await this.prisma.productImage.create({
      data: { productId, url, isPrimary: false, sortOrder: 0, type: ProductImageType.PRINT_FILE, printSide },
    });

    return {
      id: image.id, url: image.url, altText: image.altText,
      isPrimary: image.isPrimary, sortOrder: image.sortOrder,
      type: image.type, printSide: image.printSide,
    };
  }

  /** Manual fallback for sellers who already have a real, separate design file. */
  async attachPrintFile(productId: string, url: string, printSide: PrintSide): Promise<ProductImageResponseDto> {
    await this.deletePrintFile(productId, printSide, { silent: true });
    const [created] = await this.attachImageUrls(productId, [url], { type: ProductImageType.PRINT_FILE, printSide });
    return created;
  }

  async deletePrintFile(productId: string, printSide: PrintSide, opts?: { silent?: boolean }): Promise<void> {
    const image = await this.prisma.productImage.findFirst({
      where: { productId, type: ProductImageType.PRINT_FILE, printSide },
    });
    if (!image) {
      if (opts?.silent) return;
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: `No ${printSide} print file uploaded for this product` });
    }

    await this.prisma.productImage.delete({ where: { id: image.id } });
    await this.storage
      .deleteFile(this.storage.extractKey(image.url))
      .catch((e: Error) => this.logger.warn(`S3 delete failed for print file "${image.url}": ${e.message}`));
  }

  async deleteImage(productId: string, imageId: string): Promise<void> {
    const image = await this.prisma.productImage.findUnique({
      where: { id: imageId },
    });
    if (!image || image.productId !== productId)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Image not found',
      });

    const key = this.storage.extractKey(image.url);

    // Delete from DB first (atomically update primary pointer if needed), then S3.
    // This ensures DB is always consistent even if S3 deletion fails.
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.delete({ where: { id: imageId } });
      if (image.isPrimary) {
        const next = await tx.productImage.findFirst({
          where: { productId, type: ProductImageType.MOCKUP },
          orderBy: { sortOrder: 'asc' },
        });
        if (next)
          await tx.productImage.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
      }
    });

    await this.storage
      .deleteFile(key)
      .catch((e: Error) =>
        this.logger.warn(`S3 delete failed for key "${key}": ${e.message}`),
      );
  }

  async reorderImages(productId: string, orderedIds: string[]): Promise<void> {
    await this.requireProduct(productId);
    await this.prisma.$transaction(
      orderedIds.map((imgId, idx) =>
        this.prisma.productImage.update({
          where: { id: imgId },
          data: { sortOrder: idx },
        }),
      ),
    );
  }

  // ─── Digital files (the sold deliverable for DIGITAL products) ────────────
  //
  // storageKey is deliberately never returned to any caller — see
  // DigitalFileResponseDto. The uploaded object lives under a random,
  // unguessable key (not under products/{id}/...), uploaded with
  // isPublic:false, mirroring the print-files "obscure key" tradeoff. Real
  // access control happens at download time in order-downloads.controller.ts,
  // which fetches the bytes server-side and streams them — the key/URL is
  // never handed to a client.

  async uploadDigitalFiles(
    productId: string,
    files: Express.Multer.File[],
    variantId?: string,
  ): Promise<DigitalFileResponseDto[]> {
    await this.requireProduct(productId);
    if (variantId) {
      const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
      if (!variant || variant.productId !== productId)
        throw new BadRequestException({ code: 'ERR_INVALID_VARIANT', message: 'variantId must belong to this product' });
    }

    for (const file of files) {
      if (!ALLOWED_DIGITAL_FILE_MIMETYPES.has(file.mimetype))
        throw new BadRequestException({
          code: 'ERR_INVALID_FILE_TYPE',
          message: `${file.originalname}: unsupported file type`,
        });
      if (file.size > DIGITAL_FILE_MAX_BYTES)
        throw new BadRequestException({
          code: 'ERR_FILE_TOO_LARGE',
          message: `${file.originalname}: max 50 MB per file`,
        });
    }

    const existingCount = await this.prisma.digitalFile.count({ where: { productId } });
    const created: DigitalFileResponseDto[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = this.storage.generateKey(`digital-files/${randomUUID()}`, file.originalname);
      await this.storage.uploadFile(file.buffer, key, file.mimetype, { isPublic: false });

      const record = await this.prisma.digitalFile.create({
        data: {
          productId,
          variantId: variantId ?? null,
          filename: file.originalname,
          storageKey: key,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          sortOrder: existingCount + i,
        },
      });

      created.push({
        id: record.id,
        filename: record.filename,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        sortOrder: record.sortOrder,
        variantId: record.variantId,
      });
    }

    return created;
  }

  async deleteDigitalFile(productId: string, fileId: string, opts?: { force?: boolean }): Promise<void> {
    const file = await this.prisma.digitalFile.findUnique({ where: { id: fileId } });
    if (!file || file.productId !== productId)
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Digital file not found' });

    // Entitlement is derived live from COMPLETED orders (see
    // order-downloads.controller.ts) — deleting a file that buyers already
    // paid for permanently breaks their download with no snapshot to fall
    // back to. Require an explicit second confirmation rather than silently
    // cutting off paying customers.
    if (!opts?.force) {
      const purchaseCount = await this.prisma.orderItem.count({
        where: {
          productId: file.productId,
          order: { status: OrderStatus.COMPLETED },
        },
      });
      if (purchaseCount > 0) {
        throw new ConflictException({
          code: 'ERR_HAS_PURCHASES',
          message: `${purchaseCount} completed order${purchaseCount === 1 ? ' has' : 's have'} already purchased this product — deleting this file will break their download. Confirm again to proceed anyway.`,
          purchaseCount,
        });
      }
    }

    await this.prisma.digitalFile.delete({ where: { id: fileId } });
    await this.storage
      .deleteFile(file.storageKey)
      .catch((e: Error) => this.logger.warn(`S3 delete failed for digital file "${file.storageKey}": ${e.message}`));
  }

  async reorderDigitalFiles(productId: string, orderedIds: string[]): Promise<void> {
    await this.requireProduct(productId);
    await this.prisma.$transaction(
      orderedIds.map((fileId, idx) =>
        this.prisma.digitalFile.update({
          where: { id: fileId },
          data: { sortOrder: idx },
        }),
      ),
    );
  }

  // ─── Product videos ─────────────────────────────────────────────────────────

  /**
   * Reads a video's real duration via ffprobe (metadata-only inspection — no
   * decoding/transcoding, so this stays fast and cheap even on a shared,
   * unthrottled host). A client-declared duration can't be trusted, so this
   * is the only source of truth for enforcing the length cap.
   */
  /**
   * Writes the upload to a temp file once and hands the path to `fn`.
   *
   * ffprobe and ffmpeg both need a real seekable file — neither reads a
   * container reliably from a pipe, because both have to jump to the moov
   * atom to find the stream layout. Duration probing used to write its own
   * temp copy; extracting poster frames as well would have meant writing the
   * same 20 MB buffer to disk twice per upload, so both now share one copy.
   */
  private async withTempVideo<T>(
    buffer: Buffer,
    originalName: string,
    fn: (path: string) => Promise<T>,
  ): Promise<T> {
    const tmpPath = join(tmpdir(), `video-${randomUUID()}${extname(originalName)}`);
    await writeFile(tmpPath, buffer);
    try {
      return await fn(tmpPath);
    } finally {
      await unlink(tmpPath).catch(() => undefined);
    }
  }

  private async probeDurationSeconds(path: string, originalName: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'json',
        path,
      ]);
      const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
      const duration = Number(parsed.format?.duration);
      if (!Number.isFinite(duration)) throw new Error('unreadable duration');
      return duration;
    } catch {
      throw new BadRequestException({
        code: 'ERR_INVALID_VIDEO',
        message: `${originalName}: could not read this file as a video — is it a valid MP4, WebM, or MOV?`,
      });
    }
  }

  /**
   * Pulls two JPEG poster frames out of the clip: one full size keeping the
   * original aspect ratio, one square-cropped for grid cards.
   *
   * Seeks a little way in rather than taking frame 0 — the opening frame of a
   * clip is very often black or a fade-in, which makes a poster that looks
   * like a broken image. Clamped to the midpoint so a very short clip cannot
   * seek past its own end.
   *
   * Best-effort by design: a clip whose duration probed fine but whose first
   * frames will not decode still uploads, just without a poster. Failing the
   * whole upload over a missing thumbnail is a worse outcome than a video
   * that falls back to the product image.
   */
  private async extractPosterFrames(
    path: string,
    durationSeconds: number,
  ): Promise<{ full: Buffer | null; square: Buffer | null }> {
    const seek = Math.min(VIDEO_POSTER_SEEK_SECONDS, durationSeconds / 2);
    const fullPath   = join(tmpdir(), `poster-${randomUUID()}.jpg`);
    const squarePath = join(tmpdir(), `poster-sq-${randomUUID()}.jpg`);

    // -ss BEFORE -i is input seeking: ffmpeg jumps straight to the nearest
    // keyframe instead of decoding from the start and discarding frames.
    const run = (out: string, filter: string[]) =>
      execFileAsync('ffmpeg', [
        '-v', 'error',
        '-ss', String(seek),
        '-i', path,
        '-frames:v', '1',
        ...filter,
        '-q:v', '3',
        '-y', out,
      ]);

    try {
      await run(fullPath, []);
      // scale-then-crop: grow until the SHORTER side reaches the target, then
      // take the centre square. Cropping first would throw away the edges of
      // a wide clip before scaling ever saw them.
      await run(squarePath, [
        '-vf',
        `scale=${VIDEO_POSTER_SQUARE_PX}:${VIDEO_POSTER_SQUARE_PX}:force_original_aspect_ratio=increase,crop=${VIDEO_POSTER_SQUARE_PX}:${VIDEO_POSTER_SQUARE_PX}`,
      ]);
      const [full, square] = await Promise.all([readFile(fullPath), readFile(squarePath)]);
      return { full, square };
    } catch (e) {
      this.logger.warn(
        `Poster extraction failed, uploading video without one: ${(e as Error).message}`,
      );
      return { full: null, square: null };
    } finally {
      await Promise.all([
        unlink(fullPath).catch(() => undefined),
        unlink(squarePath).catch(() => undefined),
      ]);
    }
  }

  // Video row -> DTO lives in ./product-video.mapper so this service and
  // SearchService share ONE implementation. The three list mappers in this
  // file have a documented history of drifting when a field is added to one
  // and missed in the others; a shared function cannot drift from itself.
  private toVideoDto(v: ProductVideoRow): ProductVideoDto {
    return toProductVideoDto(v);
  }

  async listVideos(productId: string): Promise<ProductVideoDto[]> {
    const videos = await this.prisma.productVideo.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return videos.map((v) => this.toVideoDto(v));
  }

  /**
   * Records a video that is already hosted somewhere else. Nothing is fetched,
   * nothing is uploaded, nothing is transcoded — the URLs are stored as given.
   *
   * The trade that buys: we cannot verify any of it. The duration is whatever
   * the caller says, the poster is whatever they point at, and the media can
   * change or disappear afterwards without us knowing. That is acceptable for
   * a trusted, allowlisted source and would not be for arbitrary input, which
   * is why the host allowlist is the gate rather than a nice-to-have.
   */
  async attachVideoFromUrl(
    productId: string,
    dto: {
      url: string;
      thumbnail_urls?: string[];
      duration?: string;
      uploaded_at?: string;
    },
  ): Promise<ProductVideoDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    });
    if (!product)
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    const isOwn = (u: string) => this.storage.isOwnStorageUrl(u);

    // Every URL goes through the same gate, posters included: a poster is
    // rendered on the card and the gallery just as the video is, so allowing
    // one from an unvetted host through a side door would defeat the point.
    for (const candidate of [dto.url, ...(dto.thumbnail_urls ?? [])]) {
      const check = checkExternalMediaUrl(candidate, isOwn);
      if (!check.ok) {
        throw new BadRequestException({
          code: check.reason,
          message:
            check.reason === 'ERR_MEDIA_URL_OWN_STORAGE'
              ? 'That URL points at our own storage — upload the file instead of attaching it by URL.'
              : check.reason === 'ERR_MEDIA_HOST_NOT_ALLOWED'
                ? `Host "${check.host}" is not on the allowed media host list.`
                : 'Media URLs must be absolute https URLs.',
        });
      }
    }

    const existingCount = await this.prisma.productVideo.count({ where: { productId } });
    if (existingCount >= MAX_VIDEOS_PER_PRODUCT)
      throw new BadRequestException({
        code: 'ERR_TOO_MANY_VIDEOS',
        message: `Only ${MAX_VIDEOS_PER_PRODUCT} videos allowed per product — remove one first.`,
      });

    // Incoming order is [square, full-size]; the columns are named, so the
    // asymmetry with the response order is resolved once, here, rather than
    // being carried around as a convention nobody remembers.
    const [square, full] = dto.thumbnail_urls ?? [];

    let createdAt: Date | undefined;
    if (dto.uploaded_at) {
      const parsed = new Date(dto.uploaded_at);
      if (Number.isNaN(parsed.getTime()))
        throw new BadRequestException({
          code: 'ERR_VALIDATION',
          message: 'uploaded_at is not a valid date.',
        });
      // A future timestamp would sort ahead of everything and read as nonsense
      // in any "uploaded" column. Small clock skew is tolerated.
      if (parsed.getTime() > Date.now() + 60_000)
        throw new BadRequestException({
          code: 'ERR_VALIDATION',
          message: 'uploaded_at cannot be in the future.',
        });
      createdAt = parsed;
    }

    const [video, updated] = await this.prisma.$transaction([
      this.prisma.productVideo.create({
        data: {
          productId,
          url: dto.url,
          posterUrl: full ?? null,
          posterSquareUrl: square ?? null,
          durationSeconds: parseIso8601Duration(dto.duration),
          sortOrder: existingCount,
          ...(createdAt ? { createdAt } : {}),
        },
      }),
      this.prisma.product.update({
        where: { id: productId },
        data: { videoUrls: { push: dto.url } },
        select: { slug: true },
      }),
    ]);
    await this.redis.del(CacheKeys.product(updated.slug));

    return this.toVideoDto(video);
  }

  async uploadVideo(
    productId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string; videoUrls: string[]; video: ProductVideoDto }> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { videoUrls: true },
    });
    if (!product)
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    if (!file?.buffer)
      throw new BadRequestException({
        code: 'ERR_NO_FILE',
        message: 'No video file was uploaded — send it as multipart field "video".',
      });
    if (!ALLOWED_VIDEO_MIMETYPES.has(file.mimetype))
      throw new BadRequestException({
        code: 'ERR_INVALID_FILE_TYPE',
        message: `${file.originalname}: only MP4, WebM, or MOV allowed`,
      });
    if (file.size > VIDEO_MAX_BYTES)
      throw new BadRequestException({
        code: 'ERR_FILE_TOO_LARGE',
        message: `${file.originalname}: max ${VIDEO_MAX_BYTES / (1024 * 1024)} MB per video`,
      });

    // Counted off ProductVideo, not off the legacy videoUrls array: the row
    // table is the source of truth now, and counting the deprecated mirror
    // would let the limit drift the moment the two disagree.
    const existingCount = await this.prisma.productVideo.count({ where: { productId } });
    if (existingCount >= MAX_VIDEOS_PER_PRODUCT)
      throw new BadRequestException({
        code: 'ERR_TOO_MANY_VIDEOS',
        message: `Only ${MAX_VIDEOS_PER_PRODUCT} videos allowed per product — remove one first.`,
      });

    const { duration, posters } = await this.withTempVideo(
      file.buffer,
      file.originalname,
      async (path) => {
        const probed = await this.probeDurationSeconds(path, file.originalname);
        if (probed > VIDEO_MAX_DURATION_SECONDS + VIDEO_DURATION_TOLERANCE_SECONDS)
          throw new BadRequestException({
            code: 'ERR_VIDEO_TOO_LONG',
            message: `${file.originalname}: video is ${probed.toFixed(1)}s — max ${VIDEO_MAX_DURATION_SECONDS}s allowed.`,
          });
        return { duration: probed, posters: await this.extractPosterFrames(path, probed) };
      },
    );

    const key = this.storage.generateKey(`products/${productId}/videos`, file.originalname);
    const url = await this.storage.uploadFile(file.buffer, key, file.mimetype);

    const posterUrl = posters.full
      ? await this.storage.uploadFile(
          posters.full,
          this.storage.generateKey(`products/${productId}/videos`, 'poster.jpg'),
          'image/jpeg',
        )
      : null;
    const posterSquareUrl = posters.square
      ? await this.storage.uploadFile(
          posters.square,
          this.storage.generateKey(`products/${productId}/videos`, 'poster-sq.jpg'),
          'image/jpeg',
        )
      : null;

    const [video, updated] = await this.prisma.$transaction([
      this.prisma.productVideo.create({
        data: {
          productId,
          url,
          posterUrl,
          posterSquareUrl,
          durationSeconds: duration,
          sortOrder: existingCount,
        },
      }),
      // Deprecated mirror, kept in step so partners still reading videoUrls
      // see the new clip. Written in the same transaction as the row so the
      // two cannot diverge on a partial failure.
      this.prisma.product.update({
        where: { id: productId },
        data: { videoUrls: { push: url } },
        select: { videoUrls: true, slug: true },
      }),
    ]);
    await this.redis.del(CacheKeys.product(updated.slug));

    return { url, videoUrls: updated.videoUrls, video: this.toVideoDto(video) };
  }

  /** Deletes every stored object behind one video row, best-effort. */
  private async purgeVideoObjects(v: {
    url: string;
    posterUrl: string | null;
    posterSquareUrl: string | null;
  }): Promise<void> {
    // Only objects we host. A video attached by URL lives on someone else's
    // infrastructure — there is nothing of ours to delete, and extractKey()
    // returns such a URL unchanged, so without this filter we would issue a
    // delete for a "key" that is really a foreign URL.
    const urls = [v.url, v.posterUrl, v.posterSquareUrl]
      .filter((u): u is string => !!u)
      .filter((u) => this.storage.isOwnStorageUrl(u));

    await Promise.all(
      urls.map((u) => {
        const key = this.storage.extractKey(u);
        return this.storage
          .deleteFile(key)
          .catch((e: Error) =>
            this.logger.warn(`R2 delete failed for video key "${key}": ${e.message}`),
          );
      }),
    );
  }

  async deleteVideoById(productId: string, videoId: string): Promise<void> {
    const video = await this.prisma.productVideo.findFirst({
      where: { id: videoId, productId },
    });
    if (!video)
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Video not found' });
    await this.removeVideoRow(productId, video);
  }

  /** Legacy entry point — deletes by URL rather than by row id. */
  async deleteVideo(productId: string, url: string): Promise<void> {
    const video = await this.prisma.productVideo.findFirst({ where: { productId, url } });
    if (video) {
      await this.removeVideoRow(productId, video);
      return;
    }

    // No row for this URL, but the deprecated array may still carry it (a clip
    // uploaded before this table existed that somehow missed the backfill).
    // Drop it from the array so the caller's delete is not silently a no-op.
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { videoUrls: true, slug: true },
    });
    if (!product)
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
    if (!product.videoUrls.includes(url))
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Video not found' });

    await this.prisma.product.update({
      where: { id: productId },
      data: { videoUrls: { set: product.videoUrls.filter((u) => u !== url) } },
    });
    await this.redis.del(CacheKeys.product(product.slug));
    await this.purgeVideoObjects({ url, posterUrl: null, posterSquareUrl: null });
  }

  private async removeVideoRow(
    productId: string,
    video: { id: string; url: string; posterUrl: string | null; posterSquareUrl: string | null },
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { videoUrls: true, slug: true },
    });
    if (!product)
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    const [, updated] = await this.prisma.$transaction([
      this.prisma.productVideo.delete({ where: { id: video.id } }),
      this.prisma.product.update({
        where: { id: productId },
        data: { videoUrls: { set: product.videoUrls.filter((u) => u !== video.url) } },
        select: { slug: true },
      }),
    ]);
    await this.redis.del(CacheKeys.product(updated.slug));

    // Storage cleanup runs AFTER the row is gone, and never inside the
    // transaction: an object-store timeout must not roll back a delete the
    // caller already saw succeed. A leaked object is cheap; a video that
    // reappears after being deleted is not.
    await this.purgeVideoObjects(video);
  }

  // ─── MongoDB product detail CRUD ──────────────────────────────────────────

  async getProductDetail(productId: string): Promise<ProductDetail | null> {
    await this.requireProduct(productId);
    return this.productDetailModel
      .findOne({ productId })
      .lean<ProductDetail>()
      .exec();
  }

  async upsertProductDetail(
    productId: string,
    dto: CreateProductDetailDto,
  ): Promise<ProductDetail> {
    await this.requireProduct(productId);
    const doc = await this.productDetailModel.findOneAndUpdate(
      { productId },
      {
        $set: {
          ...(dto.richDescription   !== undefined && { richDescription:  dto.richDescription }),
          ...(dto.sizeGuide         !== undefined && { sizeGuide:        dto.sizeGuide }),
          ...(dto.shippingNote      !== undefined && { shippingNote:     dto.shippingNote }),
          ...(dto.attributes        !== undefined && { attributes:       dto.attributes }),
          ...(dto.variantOptions    !== undefined && { variantOptions:   dto.variantOptions }),
          ...(dto.variants          !== undefined && { variants:         dto.variants }),
          ...(dto.customization     !== undefined && { customization:    dto.customization }),
          ...(dto.imageAltTexts     !== undefined && { imageAltTexts:    dto.imageAltTexts }),
          ...(dto.gpsrInfo          !== undefined && { gpsrInfo:         dto.gpsrInfo }),
        },
        $setOnInsert: { productId },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return doc!;
  }

  async addVariant(
    productId: string,
    variant: VariantDto,
  ): Promise<ProductDetail> {
    await this.requireProduct(productId);
    const existing = await this.productDetailModel.findOne({ productId });
    if (existing?.variants?.some((v: { sku: string }) => v.sku === variant.sku)) {
      throw new ConflictException({ code: 'ERR_VARIANT_SKU_TAKEN', message: `Variant SKU '${variant.sku}' already exists` });
    }
    const doc = await this.productDetailModel.findOneAndUpdate(
      { productId },
      { $push: { variants: variant }, $setOnInsert: { productId } },
      { upsert: true, returnDocument: 'after' },
    );
    return doc!;
  }

  async removeVariant(productId: string, sku: string): Promise<ProductDetail> {
    await this.requireProduct(productId);
    const doc = await this.productDetailModel.findOneAndUpdate(
      { productId },
      { $pull: { variants: { sku } } },
      { returnDocument: 'after' },
    );
    if (!doc) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product detail not found' });
    return doc;
  }

  async setAttributes(
    productId: string,
    attributes: AttributeDto[],
  ): Promise<ProductDetail> {
    await this.requireProduct(productId);
    const doc = await this.productDetailModel.findOneAndUpdate(
      { productId },
      { $set: { attributes }, $setOnInsert: { productId } },
      { upsert: true, returnDocument: 'after' },
    );
    return doc!;
  }

  async setCustomization(
    productId: string,
    customization: CustomizationTemplateDto,
  ): Promise<ProductDetail> {
    await this.requireProduct(productId);
    const doc = await this.productDetailModel.findOneAndUpdate(
      { productId },
      { $set: { customization }, $setOnInsert: { productId } },
      { upsert: true, returnDocument: 'after' },
    );
    return doc!;
  }

  // ─── In-demand counter (called by order processor) ─────────────────────────

  async incrementDemandCount(productId: string, quantity = 1): Promise<void> {
    const key = IN_DEMAND_KEY(productId);
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const secondsUntilMidnight = Math.floor(
      (midnight.getTime() - now.getTime()) / 1000,
    );
    const ttl = secondsUntilMidnight + 86400; // keep for 24h past midnight as buffer

    const existing = await this.redis.get<number>(key);
    if (existing === null) {
      await this.redis.set(key, quantity, ttl);
    } else {
      await this.redis.getClient().incrby(key, quantity);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async buildWhereClause(
    query: ProductQueryDto,
  ): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {};

    where.isActive = query.includeInactive
      ? (query.isActive ?? undefined)
      : true;
    if (query.q) {
      where.name = { contains: query.q, mode: 'insensitive' };
    }
    if (query.isFeatured !== undefined) where.isFeatured = query.isFeatured;
    if (query.isPersonalizable !== undefined) where.isPersonalizable = query.isPersonalizable;

    // Same shape SearchService already uses for its own `collection` filter —
    // resolve the slug, then match through the CollectionProduct join table.
    // An unknown slug leaves the filter off entirely rather than returning
    // nothing, matching how `category` behaves a few lines down.
    if (query.collectionSlug) {
      const col = await this.prisma.collection.findUnique({
        where:  { slug: query.collectionSlug },
        select: { id: true },
      });
      if (col) where.collections = { some: { collectionId: col.id } };
    }
    // Explicit id set (storefront "Featured items" honouring the seller's
    // Shop Home picks). Combines with every other filter below — notably
    // isActive/status — so an id the seller pinned and later archived simply
    // drops out rather than surfacing a dead listing publicly.
    if (query.ids?.length) where.id = { in: query.ids };
    if (query.status) {
      where.status = query.status;
    } else if (!query.includeInactive) {
      // Public storefront (includeInactive not set): never surface drafts by
      // default. Admin's "All listings" (includeInactive: true, no status
      // filter) means literally everything, drafts included — the stats
      // sidebar already counts drafts in its "all" total, so the list must
      // match or it silently looks like products are missing.
      where.status = { not: ProductStatus.DRAFT };
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    } else if (query.category) {
      const cat = await this.prisma.category.findUnique({
        where: { slug: query.category },
        select: { id: true },
      });
      if (cat) where.categoryId = cat.id;
    }

    if (query.collection) {
      const col = await this.prisma.collection.findUnique({
        where: { slug: query.collection },
        select: { id: true },
      });
      if (col) where.collections = { some: { collectionId: col.id } };
    }

    if (query.tags?.length) {
      where.tags = { some: { tag: { slug: { in: query.tags } } } };
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    if (query.storeId) {
      where.storeId = query.storeId;
    } else if (query.storeSlug) {
      const store = await this.prisma.store.findUnique({
        where:  { slug: query.storeSlug },
        select: { id: true },
      });
      if (store) where.storeId = store.id;
    }

    if (query.shopSectionId) {
      where.shopSectionId = query.shopSectionId;
    }

    return where;
  }

  private buildOrderBy(
    sort?: ProductSortBy,
  ):
    | Prisma.ProductOrderByWithRelationInput
    | Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case ProductSortBy.PRICE_ASC:
        return { basePrice: 'asc' };
      case ProductSortBy.PRICE_DESC:
        return { basePrice: 'desc' };
      case ProductSortBy.BESTSELLER:
        return { soldCount: 'desc' };
      case ProductSortBy.FEATURED:
        return [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
      case ProductSortBy.RATING:
        return { soldCount: 'desc' }; // DB approximation; exact rating sort needs raw SQL
      default:
        return { createdAt: 'desc' };
    }
  }

  private async getAverageRating(productId: string): Promise<number | null> {
    const agg = await this.prisma.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { rating: true },
    });
    if (!agg._count.rating) return null;
    return Math.round((agg._avg.rating ?? 0) * 10) / 10;
  }

  private async requireProduct(id: string): Promise<void> {
    const p = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!p)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Product not found',
      });
  }

  // ─── Seller-scoped product methods ────────────────────────────────────────

  async createDraftForStore(storeId: string): Promise<ProductResponseDto> {
    const placeholder = await this.prisma.category.findFirst({
      where:   { isVisible: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      select:  { id: true },
    });
    if (!placeholder) throw new BadRequestException({
      code:    'ERR_NO_CATEGORIES',
      message: 'No categories found',
    });

    let sku: string;
    let skuConflict = true;
    do {
      sku = `DRAFT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      skuConflict = !!(await this.prisma.product.findUnique({ where: { sku } }));
    } while (skuConflict);

    const slug = await this.resolveUniqueProductSlug(sku.toLowerCase(), undefined, storeId);

    const product = await this.prisma.product.create({
      data: {
        name:        '',
        slug,
        sku,
        description: '',
        basePrice:   0,
        categoryId:  placeholder.id,
        isActive:    false,
        // Explicit, because Product.status defaults to ACTIVE in the schema.
        // Leaving it off meant every unfinished draft was stored as ACTIVE and
        // getStats() — which counts by `status` alone — reported them as live
        // listings while showing draft: 0. Storefront queries were unaffected
        // (they filter isActive), so this only ever surfaced as wrong numbers
        // on the seller dashboard.
        status:      ProductStatus.DRAFT,
        storeId,
      },
    });
    // No fee here. Creating a draft is free — it is billed on publish, by
    // publishProducts(). Charging at this point meant a seller who opened the
    // create form and closed the tab paid for a listing that never existed;
    // that happened twice in production. See docs/listing-fee.md.
    return this.findByIdAdmin(product.id);
  }

  async findByIdForStore(id: string, storeId: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: { id, storeId },
    });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
    return this.findByIdAdmin(id);
  }

  async updateForStore(
    id: string,
    storeId: string,
    dto: Partial<{ name: string; description: string; shortDescription: string; basePrice: number; compareAtPrice: number; categoryId: string; processingDays: number; isActive: boolean; shippingProfileId: string }>,
  ): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findFirst({ where: { id, storeId } });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

    await this.prisma.product.update({
      where: { id },
      data:  {
        name:             dto.name,
        description:      dto.description,
        shortDescription: dto.shortDescription,
        basePrice:        dto.basePrice,
        compareAtPrice:   dto.compareAtPrice,
        categoryId:       dto.categoryId,
        processingDays:   dto.processingDays,
        // Publishing is NOT done here — see below. Only the unpublish
        // direction is, because it neither bills nor needs a transaction.
        // `isActive` and `status` must move together: every buyer-facing query
        // goes through buildWhereClause, which requires BOTH isActive: true and
        // status != DRAFT, so flipping isActive alone would leave a listing
        // that reads as published but never appears on the storefront.
        ...(dto.isActive === false && {
          isActive: false,
          status:   ProductStatus.INACTIVE,
        }),
        shippingProfileId: dto.shippingProfileId,
      },
    });

    // Publishing goes through the shared path so this endpoint bills exactly
    // like the bulk action does — one rule, one implementation. It also runs
    // the ledger write and the status flip in a single transaction, which a
    // plain update here could not.
    if (dto.isActive === true) {
      await this.publishProducts([id]);
    }

    // fire-and-forget
    this.moderationService?.queueProductModeration(id).catch((e) => this.logger.error('mod queue failed', e));

    await this.redis.invalidatePattern('products:list:*');
    return this.findByIdAdmin(id);
  }

  async deleteForStore(id: string, storeId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id, storeId } });
    if (!product) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
    // status must move to ARCHIVED (not just isActive/deletedAt) — buildWhereClause,
    // the query every seller/admin/storefront list goes through, filters on `status`
    // and never checks `deletedAt`. Same fix as ProductsService.delete() above.
    await this.prisma.product.update({
      where: { id },
      data:  { isActive: false, deletedAt: new Date(), status: ProductStatus.ARCHIVED },
    });
    await this.redis.invalidatePattern('products:list:*');
  }

  async getSellerCategories() {
    return this.prisma.category.findMany({
      where:   { isVisible: true, storeId: null },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      select:  { id: true, name: true, slug: true, level: true, parentId: true },
    });
  }

  private async resolveUniqueProductSlug(
    source: string,
    excludeId?: string,
    storeId?: string | null,
  ): Promise<string> {
    const base = this.slugify(source).substring(0, 200);
    let slug = base;
    let counter = 2;
    while (
      await this.prisma.product.findFirst({
        where: {
          slug,
          storeId: storeId ?? null,
          NOT: excludeId ? { id: excludeId } : undefined,
        },
      })
    ) {
      slug = `${base}-${counter++}`;
    }
    return slug;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private fullProductInclude() {
    return {
      category: { select: { id: true, name: true, slug: true } },
      variants: { orderBy: { sortOrder: 'asc' as const } },
      images: { orderBy: { sortOrder: 'asc' as const } },
      videos: { orderBy: { sortOrder: 'asc' as const } },
      digitalFiles: { orderBy: { sortOrder: 'asc' as const } },
      tags: {
        include: { tag: { select: { id: true, name: true, slug: true } } },
      },
      _count: {
        select: { reviews: { where: { status: 'APPROVED' as const } } },
      },
    };
  }

  private async toListItems(
    products: Array<{
      id: string;
      name: string;
      slug: string;
      sku: string;
      basePrice: unknown;
      compareAtPrice: unknown;
      images: { url: string }[];
      categoryId: string;
      category: { id: string; name: string; slug: string };
      // Present at runtime already: the queries use Prisma `include`, which
      // returns every scalar column. Only this hand-written row type had to
      // be widened — no extra database work.
      primaryColors: string[];
      productType: string;
      videos?: ProductVideoRow[];
      isPersonalizable: boolean;
      isFeatured: boolean;
      isActive: boolean;
      status: string;
      quantity: number | null;
      viewCount: number;
      soldCount: number;
      _count: { reviews: number };
      createdAt: Date;
    }>,
  ): Promise<ProductListItemDto[]> {
    if (products.length === 0) return [];

    const ids = products.map((p) => p.id);
    const [ratingRows, inDemandEntries, priceRangeRows] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['productId'],
        where: { productId: { in: ids }, status: 'APPROVED' },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      Promise.all(ids.map((id) => this.redis.get<number>(IN_DEMAND_KEY(id)))),
      this.prisma.productVariant.groupBy({
        by: ['productId'],
        where: { productId: { in: ids }, isAvailable: true, price: { not: null } },
        _min: { price: true },
        _max: { price: true },
      }),
    ]);

    const ratingMap = new Map(
      ratingRows.map((r) => [
        r.productId,
        r._count.rating ? Math.round((r._avg.rating ?? 0) * 10) / 10 : null,
      ]),
    );
    const inDemandMap = new Map(
      ids.map((id, i) => [id, inDemandEntries[i] ?? 0]),
    );
    const priceRangeMap = new Map(
      priceRangeRows.map((r) => [
        r.productId,
        { min: Number(r._min.price), max: Number(r._max.price) },
      ]),
    );

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      basePrice: Number(p.basePrice),
      compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
      minPrice: priceRangeMap.get(p.id)?.min ?? null,
      maxPrice: priceRangeMap.get(p.id)?.max ?? null,
      primaryImageUrl: p.images[0]?.url ?? null,
      primaryImage:    p.images[0]?.url ?? null,
      images:          p.images.map((img) => ({ url: img.url, isPrimary: true })),
      categoryId: p.categoryId,
      categoryName: p.category.name,
      categorySlug: p.category.slug,
      // Kept identical to SearchService.toListItems — see the note on
      // ProductListItemDto.primaryColors. Free: `include` already fetched it.
      primaryColors: p.primaryColors ?? [],
      productType: p.productType,
      videos: (p.videos ?? []).map(toProductVideoDto),
      isPersonalizable: p.isPersonalizable,
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      status: p.status,
      quantity: p.quantity,
      viewCount: p.viewCount,
      soldCount: p.soldCount,
      averageRating: ratingMap.get(p.id) ?? null,
      reviewCount: p._count.reviews,
      inDemandCount: inDemandMap.get(p.id) ?? 0,
      createdAt: p.createdAt,
    }));
  }

  private mapToProductResponse(
    product: {
      id: string;
      name: string;
      slug: string;
      sku: string;
      description: string;
      shortDescription: string | null;
      basePrice: unknown;
      compareAtPrice: unknown;
      isPersonalizable: boolean;
      isActive: boolean;
      productType?: ProductType;
      isFeatured: boolean;
      viewCount: number;
      soldCount: number;
      processingDays: number;
      customizationConfig: unknown;
      createdAt: Date;
      updatedAt: Date;
      category: { id: string; name: string; slug: string };
      store?: { id: string; name: string; slug: string } | null;
      variants: {
        id: string;
        name: string;
        options: unknown;
        price: unknown;
        quantity: number | null;
        isAvailable: boolean;
        sku: string | null;
        isDefault: boolean;
        sortOrder: number;
      }[];
      images: {
        id: string;
        url: string;
        altText: string | null;
        isPrimary: boolean;
        sortOrder: number;
        type: ProductImageType;
        printSide: PrintSide | null;
      }[];
      digitalFiles?: {
        id: string;
        filename: string;
        mimeType: string;
        sizeBytes: number;
        sortOrder: number;
        variantId: string | null;
      }[];
      videoUrls?: string[];
      videos?: {
        id: string;
        url: string;
        posterUrl: string | null;
        posterSquareUrl: string | null;
        durationSeconds: number | null;
        createdAt: Date;
      }[];
      tags: { tag: { id: string; name: string; slug: string } }[];
      _count: { reviews: number };
    },
    inDemandCount: number,
    averageRating: number | null,
  ): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      description: product.description,
      shortDescription: product.shortDescription,
      basePrice: Number(product.basePrice),
      compareAtPrice: product.compareAtPrice
        ? Number(product.compareAtPrice)
        : null,
      isPersonalizable: product.isPersonalizable,
      isActive: product.isActive,
      productType: product.productType ?? ProductType.PHYSICAL,
      isFeatured: product.isFeatured,
      viewCount: product.viewCount,
      soldCount: product.soldCount,
      processingDays: product.processingDays,
      category: product.category,
      store: product.store ?? null,
      // Retired combinations (isAvailable:false) are never shown to buyers —
      // they only stay in the DB to keep historical orders/fulfillment intact.
      // A still-visible combo with no price of its own (shouldn't happen once
      // publish is blocked on it, but defend anyway) falls back to basePrice
      // rather than surfacing $0.
      variants: product.variants.filter((v) => v.isAvailable).map((v) => ({
        id: v.id,
        name: v.name,
        options: v.options as Record<string, string>,
        price: v.price !== null ? Number(v.price) : Number(product.basePrice),
        sku: v.sku,
        isDefault: v.isDefault,
        sortOrder: v.sortOrder,
      })),
      images: product.images.map((img) => ({
        id: img.id,
        url: img.url,
        altText: img.altText,
        isPrimary: img.isPrimary,
        sortOrder: img.sortOrder,
        type: img.type,
        printSide: img.printSide,
      })),
      digitalFiles: product.digitalFiles?.map((f) => ({
        id: f.id,
        filename: f.filename,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        sortOrder: f.sortOrder,
        variantId: f.variantId,
      })) ?? [],
      videos: (product.videos ?? []).map((v) => this.toVideoDto(v)),
      // Deprecated mirror. Derived from the rows when they are loaded so the two
      // agree, falling back to the stored array for callers whose query did not
      // include the relation.
      videoUrls: product.videos?.length ? product.videos.map((v) => v.url) : (product.videoUrls ?? []),
      tags: product.tags.map((pt) => ({
        id: pt.tag.id,
        name: pt.tag.name,
        slug: pt.tag.slug,
      })),
      customizationConfig: product.customizationConfig as Record<
        string,
        unknown
      > | null,
      variantOptions: [],
      averageRating,
      reviewCount: product._count.reviews,
      inDemandCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  // ─── Recently viewed (Redis sorted set) ───────────────────────────────────

  async trackViewed(productId: string, userId: string): Promise<void> {
    const key = `user:${userId}:viewed`;
    const client = this.redis.getClient();
    await client.zadd(key, Date.now(), productId);
    // Keep last 50 entries
    await client.zremrangebyrank(key, 0, -51);
    await client.expire(key, 30 * 24 * 3600);
  }

  async getRecentlyViewed(userId: string): Promise<ProductListItemDto[]> {
    const key = `user:${userId}:viewed`;
    const productIds = await this.redis.getClient().zrevrange(key, 0, 7);

    if (!productIds.length) return [];

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
        _count: { select: { reviews: { where: { status: 'APPROVED' } } } },
      },
    });

    const ordered = productIds
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean) as typeof products;

    return this.toListItems(ordered);
  }
}
