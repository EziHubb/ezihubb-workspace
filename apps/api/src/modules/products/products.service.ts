import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService, CacheKeys, CacheTtl } from '../../common/services/redis.service';
import { StorageService } from '../../common/services/storage.service';
import { ProductQueryDto, ProductSortBy } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductListItemDto } from './dto/product-list-item.dto';
import { ProductResponseDto, VariantResponseDto, ProductImageResponseDto, ProductTagResponseDto } from './dto/product-response.dto';
import { PaginatedResult, paginatedResponse } from '../../common/dto/paginated-response.dto';

const IN_DEMAND_KEY = (productId: string) => `product:demand:${productId}`;
const VIEW_LOCK_KEY = (slug: string, lockId: string) => `product:view:lock:${slug}:${lockId}`;
const ALLOWED_IMAGE_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  // ─── Public — list ─────────────────────────────────────────────────────────

  async findAll(query: ProductQueryDto): Promise<PaginatedResult<ProductListItemDto>> {
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
          images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
          _count: { select: { reviews: { where: { status: 'APPROVED' } } } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // Batch rating aggregation and in-demand counts — avoid N+1
    const productIds = products.map((p) => p.id);
    const [ratingRows, inDemandEntries] = await Promise.all([
      this.prisma.review.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, status: 'APPROVED' },
        _avg: { rating: true },
        _count: { rating: true },
      }),
      Promise.all(productIds.map((id) => this.redis.get<number>(IN_DEMAND_KEY(id)))),
    ]);

    const ratingMap = new Map(
      ratingRows.map((r) => [r.productId, r._count.rating ? Math.round((r._avg.rating ?? 0) * 10) / 10 : null]),
    );
    const inDemandMap = new Map(productIds.map((id, i) => [id, inDemandEntries[i] ?? 0]));

    const data = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      basePrice: Number(p.basePrice),
      compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
      primaryImageUrl: p.images[0]?.url ?? null,
      categoryId: p.categoryId,
      categoryName: p.category.name,
      isPersonalizable: p.isPersonalizable,
      isFeatured: p.isFeatured,
      viewCount: p.viewCount,
      soldCount: p.soldCount,
      averageRating: ratingMap.get(p.id) ?? null,
      reviewCount: p._count.reviews,
      inDemandCount: inDemandMap.get(p.id) ?? 0,
      createdAt: p.createdAt,
    } satisfies ProductListItemDto));

    return paginatedResponse<ProductListItemDto>(data, page, limit, total);
  }

  // ─── Public — detail ───────────────────────────────────────────────────────

  async findBySlug(slug: string, viewLockId?: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: { slug, isActive: true },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        variants: { orderBy: { sortOrder: 'asc' } },
        images: { orderBy: { sortOrder: 'asc' } },
        tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
        _count: { select: { reviews: { where: { status: 'APPROVED' } } } },
      },
    });

    if (!product) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
    }

    // Debounced view count — one increment per session/IP per hour
    if (viewLockId) {
      const lockKey = VIEW_LOCK_KEY(slug, viewLockId);
      const seen = await this.redis.exists(lockKey);
      if (!seen) {
        await this.redis.set(lockKey, 1, 3600);
        await this.prisma.product
          .update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } })
          .catch(() => {/* non-critical */});
      }
    }

    const inDemandCount = (await this.redis.get<number>(IN_DEMAND_KEY(product.id))) ?? 0;
    const averageRating = await this.getAverageRating(product.id);

    return this.mapToProductResponse(
      product as Parameters<typeof this.mapToProductResponse>[0],
      inDemandCount,
      averageRating,
    );
  }

  async findRelated(productId: string): Promise<ProductListItemDto[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true, tags: { select: { tagId: true } } },
    });
    if (!product) return [];

    const tagIds = product.tags.map((t) => t.tagId);

    const related = await this.prisma.product.findMany({
      where: {
        isActive: true,
        id: { not: productId },
        OR: [
          { categoryId: product.categoryId },
          ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : []),
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

    return Promise.all(related.map((p) => this.toListItem(p)));
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

    return Promise.all(products.map((p) => this.toListItem(p)));
  }

  // ─── Admin — CRUD ──────────────────────────────────────────────────────────

  async create(dto: CreateProductDto): Promise<ProductResponseDto> {
    if (dto.compareAtPrice !== undefined && dto.compareAtPrice <= dto.basePrice) {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'compareAtPrice must be greater than basePrice' });
    }

    const skuExists = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (skuExists) throw new ConflictException({ code: 'ERR_SKU_TAKEN', message: 'SKU is already in use' });

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new BadRequestException({ code: 'ERR_NOT_FOUND', message: 'Category not found' });

    const slug = await this.resolveUniqueProductSlug(dto.slug ?? `${dto.name}-${dto.sku}`);

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
        isFeatured: dto.isFeatured ?? false,
        processingDays: dto.processingDays ?? 3,
        categoryId: dto.categoryId,
        customizationConfig: (dto.customizationConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        variants: dto.variants?.length
          ? { create: dto.variants.map((v, i) => ({ name: v.name, options: v.options as Prisma.InputJsonValue, price: v.price, sku: v.sku, isDefault: v.isDefault ?? i === 0, sortOrder: v.sortOrder ?? i })) }
          : undefined,
        tags: dto.tagIds?.length
          ? { create: dto.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        collections: dto.collectionIds?.length
          ? { create: dto.collectionIds.map((collectionId, i) => ({ collectionId, sortOrder: i })) }
          : undefined,
      },
      include: this.fullProductInclude(),
    });

    await this.redis.invalidatePattern('products:list:*');
    return this.mapToProductResponse(product as Parameters<typeof this.mapToProductResponse>[0], 0, null);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductResponseDto> {
    await this.requireProduct(id);

    if (dto.compareAtPrice !== undefined && dto.basePrice !== undefined && dto.compareAtPrice <= dto.basePrice) {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'compareAtPrice must be greater than basePrice' });
    }

    const data: Prisma.ProductUpdateInput = {};
    const fields: (keyof UpdateProductDto)[] = ['name', 'description', 'shortDescription', 'basePrice', 'compareAtPrice', 'isPersonalizable', 'isActive', 'isFeatured', 'processingDays'];
    for (const f of fields) {
      if (dto[f] !== undefined) (data as Record<string, unknown>)[f] = dto[f];
    }
    if (dto.categoryId !== undefined) data.category = { connect: { id: dto.categoryId } };
    if (dto.customizationConfig !== undefined) data.customizationConfig = dto.customizationConfig as Prisma.InputJsonValue;

    if (dto.slug !== undefined) {
      const conflict = await this.prisma.product.findFirst({ where: { slug: dto.slug, NOT: { id } } });
      if (conflict) throw new ConflictException({ code: 'ERR_SLUG_TAKEN', message: 'Slug is already in use' });
      data.slug = dto.slug;
    }

    if (dto.tagIds !== undefined) {
      data.tags = { deleteMany: {}, create: dto.tagIds.map((tagId) => ({ tagId })) };
    }
    if (dto.collectionIds !== undefined) {
      data.collections = { deleteMany: {}, create: dto.collectionIds.map((collectionId, i) => ({ collectionId, sortOrder: i })) };
    }

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: this.fullProductInclude(),
    });

    await this.redis.invalidatePattern('products:list:*');
    await this.redis.del(CacheKeys.product(product.slug));

    const inDemandCount = (await this.redis.get<number>(IN_DEMAND_KEY(id))) ?? 0;
    return this.mapToProductResponse(product as Parameters<typeof this.mapToProductResponse>[0], inDemandCount, await this.getAverageRating(id));
  }

  async delete(id: string): Promise<void> {
    await this.requireProduct(id);
    const p = await this.prisma.product.update({ where: { id }, data: { isActive: false }, select: { slug: true } });
    await this.redis.invalidatePattern('products:list:*');
    await this.redis.del(CacheKeys.product(p.slug));
  }

  async duplicate(id: string): Promise<ProductResponseDto> {
    const source = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true, tags: true },
    });
    if (!source) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });

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
        isFeatured: false,
        processingDays: source.processingDays,
        categoryId: source.categoryId,
        customizationConfig: source.customizationConfig ?? Prisma.JsonNull,
        variants: { create: source.variants.map((v) => ({ name: v.name, options: v.options as Prisma.InputJsonValue, price: v.price, sku: v.sku ? `${v.sku}-COPY` : undefined, isDefault: v.isDefault, sortOrder: v.sortOrder })) },
        tags: { create: source.tags.map((t) => ({ tagId: t.tagId })) },
      },
      include: this.fullProductInclude(),
    });

    return this.mapToProductResponse(product as Parameters<typeof this.mapToProductResponse>[0], 0, null);
  }

  // ─── Admin — Images ────────────────────────────────────────────────────────

  async uploadImages(productId: string, files: Express.Multer.File[]): Promise<ProductImageResponseDto[]> {
    await this.requireProduct(productId);

    for (const file of files) {
      if (!ALLOWED_IMAGE_MIMETYPES.has(file.mimetype))
        throw new BadRequestException({ code: 'ERR_INVALID_FILE_TYPE', message: `${file.originalname}: only JPEG, PNG, WebP allowed` });
      if (file.size > IMAGE_MAX_BYTES)
        throw new BadRequestException({ code: 'ERR_FILE_TOO_LARGE', message: `${file.originalname}: max 10 MB per image` });
    }

    const existingCount = await this.prisma.productImage.count({ where: { productId } });
    const hasPrimary = await this.prisma.productImage.count({ where: { productId, isPrimary: true } });
    let primarySet = hasPrimary > 0;

    const created: ProductImageResponseDto[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key = this.storage.generateKey(`products/${productId}/images`, file.originalname);
      await this.storage.uploadFile(file.buffer, key, file.mimetype);
      const url = this.storage.getPublicUrl(key);
      const isFirst = !primarySet && i === 0;

      const image = await this.prisma.productImage.create({
        data: { productId, url, isPrimary: isFirst, sortOrder: existingCount + i },
      });
      if (isFirst) primarySet = true;

      created.push({ id: image.id, url: image.url, altText: image.altText, isPrimary: image.isPrimary, sortOrder: image.sortOrder });
    }

    const { slug } = (await this.prisma.product.findUnique({ where: { id: productId }, select: { slug: true } }))!;
    await this.redis.del(CacheKeys.product(slug));

    return created;
  }

  async deleteImage(productId: string, imageId: string): Promise<void> {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== productId)
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Image not found' });

    const key = this.storage.extractKey(image.url);
    await this.storage.deleteFile(key).catch((e) => this.logger.warn(`S3 delete failed: ${(e as Error).message}`));
    await this.prisma.productImage.delete({ where: { id: imageId } });

    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({ where: { productId }, orderBy: { sortOrder: 'asc' } });
      if (next) await this.prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
    }
  }

  async reorderImages(productId: string, orderedIds: string[]): Promise<void> {
    await this.requireProduct(productId);
    await this.prisma.$transaction(
      orderedIds.map((imgId, idx) => this.prisma.productImage.update({ where: { id: imgId }, data: { sortOrder: idx } })),
    );
  }

  // ─── In-demand counter (called by order processor) ─────────────────────────

  async incrementDemandCount(productId: string, quantity = 1): Promise<void> {
    const key = IN_DEMAND_KEY(productId);
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const secondsUntilMidnight = Math.floor((midnight.getTime() - now.getTime()) / 1000);
    const ttl = secondsUntilMidnight + 86400; // keep for 24h past midnight as buffer

    const existing = await this.redis.get<number>(key);
    if (existing === null) {
      await this.redis.set(key, quantity, ttl);
    } else {
      await this.redis.getClient().incrby(key, quantity);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async buildWhereClause(query: ProductQueryDto): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = {};

    where.isActive = query.includeInactive ? (query.isActive ?? undefined) : true;
    if (query.isFeatured !== undefined) where.isFeatured = query.isFeatured;

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    } else if (query.category) {
      const cat = await this.prisma.category.findUnique({ where: { slug: query.category }, select: { id: true } });
      if (cat) where.categoryId = cat.id;
    }

    if (query.collection) {
      const col = await this.prisma.collection.findUnique({ where: { slug: query.collection }, select: { id: true } });
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

    return where;
  }

  private buildOrderBy(sort?: ProductSortBy): Prisma.ProductOrderByWithRelationInput | Prisma.ProductOrderByWithRelationInput[] {
    switch (sort) {
      case ProductSortBy.PRICE_ASC: return { basePrice: 'asc' };
      case ProductSortBy.PRICE_DESC: return { basePrice: 'desc' };
      case ProductSortBy.BESTSELLER: return { soldCount: 'desc' };
      case ProductSortBy.FEATURED: return [{ isFeatured: 'desc' }, { createdAt: 'desc' }];
      case ProductSortBy.RATING: return { soldCount: 'desc' }; // DB approximation; exact rating sort needs raw SQL
      default: return { createdAt: 'desc' };
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
    const p = await this.prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!p) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
  }

  private async resolveUniqueProductSlug(source: string, excludeId?: string): Promise<string> {
    const base = this.slugify(source).substring(0, 200);
    let slug = base;
    let counter = 2;
    while (await this.prisma.product.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } })) {
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
      tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
      _count: { select: { reviews: { where: { status: 'APPROVED' as const } } } },
    };
  }

  private toListItem = async (p: {
    id: string; name: string; slug: string; sku: string;
    basePrice: unknown; compareAtPrice: unknown;
    images: { url: string }[];
    categoryId: string; category: { id: string; name: string; slug: string };
    isPersonalizable: boolean; isFeatured: boolean;
    viewCount: number; soldCount: number;
    _count: { reviews: number }; createdAt: Date;
  }): Promise<ProductListItemDto> => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    basePrice: Number(p.basePrice),
    compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null,
    primaryImageUrl: p.images[0]?.url ?? null,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    isPersonalizable: p.isPersonalizable,
    isFeatured: p.isFeatured,
    viewCount: p.viewCount,
    soldCount: p.soldCount,
    averageRating: await this.getAverageRating(p.id),
    reviewCount: p._count.reviews,
    inDemandCount: (await this.redis.get<number>(IN_DEMAND_KEY(p.id))) ?? 0,
    createdAt: p.createdAt,
  });

  private mapToProductResponse(
    product: {
      id: string; name: string; slug: string; sku: string; description: string;
      shortDescription: string | null; basePrice: unknown; compareAtPrice: unknown;
      isPersonalizable: boolean; isActive: boolean; isFeatured: boolean;
      viewCount: number; soldCount: number; processingDays: number;
      customizationConfig: unknown; createdAt: Date; updatedAt: Date;
      category: { id: string; name: string; slug: string };
      variants: { id: string; name: string; options: unknown; price: unknown; sku: string | null; isDefault: boolean; sortOrder: number }[];
      images: { id: string; url: string; altText: string | null; isPrimary: boolean; sortOrder: number }[];
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
      compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
      isPersonalizable: product.isPersonalizable,
      isActive: product.isActive,
      isFeatured: product.isFeatured,
      viewCount: product.viewCount,
      soldCount: product.soldCount,
      processingDays: product.processingDays,
      category: product.category,
      variants: product.variants.map((v) => ({ id: v.id, name: v.name, options: v.options as Record<string, string>, price: Number(v.price), sku: v.sku, isDefault: v.isDefault, sortOrder: v.sortOrder })),
      images: product.images.map((img) => ({ id: img.id, url: img.url, altText: img.altText, isPrimary: img.isPrimary, sortOrder: img.sortOrder })),
      tags: product.tags.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, slug: pt.tag.slug })),
      customizationConfig: product.customizationConfig as Record<string, unknown> | null,
      averageRating,
      reviewCount: product._count.reviews,
      inDemandCount,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
