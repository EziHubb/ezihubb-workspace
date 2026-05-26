import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService, CacheKeys, CacheTtl } from '../../common/services/redis.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { ProductSortBy } from '../products/dto/product-query.dto';
import { ProductListItemDto } from '../products/dto/product-list-item.dto';
import { PaginatedResult, paginatedResponse } from '../../common/dto/paginated-response.dto';

const TRENDING_KEY = 'search:trending';
const TRENDING_WINDOW_DAYS = 7;
const IN_DEMAND_KEY = (productId: string) => `product:demand:${productId}`;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ─── Full-text search ──────────────────────────────────────────────────────

  async search(query: SearchQueryDto): Promise<PaginatedResult<ProductListItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

    const where = await this.buildWhereClause(query);

    // If a keyword is provided, use PostgreSQL full-text search via raw SQL to leverage the GIN index
    if (query.q) {
      return this.fullTextSearch(query.q, where, page, limit, query.sort);
    }

    // No keyword — use regular Prisma query
    const orderBy = this.buildOrderBy(query.sort);

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: this.listInclude(),
      }),
      this.prisma.product.count({ where }),
    ]);

    const data = await this.toListItems(products);

    await this.logSearch(query.q ?? '', total).catch(() => undefined);

    return paginatedResponse<ProductListItemDto>(data, page, limit, total);
  }

  // ─── Autocomplete ──────────────────────────────────────────────────────────

  async autocomplete(q: string): Promise<string[]> {
    const clean = q.trim().toLowerCase();
    if (!clean || clean.length < 2) return [];

    const cacheKey = CacheKeys.autocomplete(clean);
    const cached = await this.redis.get<string[]>(cacheKey);
    if (cached) return cached;

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        name: { contains: clean, mode: 'insensitive' },
      },
      select: { name: true },
      orderBy: { soldCount: 'desc' },
      take: 8,
    });

    const suggestions = [...new Set(products.map((p) => p.name))].slice(0, 8);

    await this.redis.set(cacheKey, suggestions, CacheTtl.medium);
    return suggestions;
  }

  // ─── Trending keywords ─────────────────────────────────────────────────────

  async getTrending(): Promise<string[]> {
    const results = await this.redis
      .getClient()
      .zrevrange(TRENDING_KEY, 0, 9, 'WITHSCORES');

    // Results come back as [member, score, member, score, ...]
    const keywords: string[] = [];
    for (let i = 0; i < results.length; i += 2) {
      if (results[i]) keywords.push(results[i]);
    }
    return keywords;
  }

  async logSearch(query: string, resultCount: number): Promise<void> {
    const clean = query.trim().toLowerCase();
    if (!clean || clean.length < 2) return;

    const client = this.redis.getClient();
    await client.zincrby(TRENDING_KEY, 1, clean);

    // Set TTL on the sorted set (7-day sliding window approximation)
    const ttl = await client.ttl(TRENDING_KEY);
    if (ttl < 0) {
      await client.expire(TRENDING_KEY, TRENDING_WINDOW_DAYS * 24 * 3600);
    }

    this.logger.debug(`Search logged: "${clean}" → ${resultCount} results`);
  }

  // ─── Private: full-text search via raw SQL (uses search_vector GIN index) ──

  private async fullTextSearch(
    q: string,
    baseWhere: Prisma.ProductWhereInput,
    page: number,
    limit: number,
    sort?: ProductSortBy,
  ): Promise<PaginatedResult<ProductListItemDto>> {
    // Build additional WHERE conditions as SQL fragments using parameterized queries
    // We query using search_vector if the column exists; otherwise fall back to ILIKE
    const offset = (page - 1) * limit;

    // Extract simple filter conditions we can replicate in SQL
    const whereParts: string[] = [
      `p."isActive" = true`,
      `p."deletedAt" IS NULL`,
    ];
    const params: unknown[] = [q, limit, offset];
    let paramIdx = 4; // next param index

    if (baseWhere.categoryId && typeof baseWhere.categoryId === 'string') {
      whereParts.push(`p."categoryId" = $${paramIdx}`);
      params.push(baseWhere.categoryId);
      paramIdx++;
    }

    if (baseWhere.basePrice) {
      const priceFilter = baseWhere.basePrice as { gte?: number; lte?: number };
      if (priceFilter.gte !== undefined) {
        whereParts.push(`p."basePrice" >= $${paramIdx}`);
        params.push(priceFilter.gte);
        paramIdx++;
      }
      if (priceFilter.lte !== undefined) {
        whereParts.push(`p."basePrice" <= $${paramIdx}`);
        params.push(priceFilter.lte);
        paramIdx++;
      }
    }

    const orderSql = this.buildRawOrderBy(sort, 'ts_rank(p.search_vector, query)');
    const whereStr = whereParts.length ? whereParts.join(' AND ') + ' AND ' : '';

    const searchSql = Prisma.sql`
      SELECT p.id
      FROM "Product" p,
           plainto_tsquery('english', ${q}) query
      WHERE ${Prisma.raw(whereStr)}
            p.search_vector @@ query
      ORDER BY ${Prisma.raw(orderSql)}
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countSql = Prisma.sql`
      SELECT COUNT(*) AS total
      FROM "Product" p,
           plainto_tsquery('english', ${q}) query
      WHERE ${Prisma.raw(whereStr)}
            p.search_vector @@ query
    `;

    // Execute raw queries; fall back to ILIKE if search_vector doesn't exist
    let productIds: string[] = [];
    let total = 0;

    try {
      const [rows, countRows] = await Promise.all([
        this.prisma.$queryRaw<{ id: string }[]>(searchSql),
        this.prisma.$queryRaw<{ total: string }[]>(countSql),
      ]);
      productIds = rows.map((r) => r.id);
      total = parseInt(countRows[0]?.total ?? '0', 10);
    } catch {
      // search_vector column not yet created — fall back to Prisma ILIKE
      this.logger.warn('search_vector not available, falling back to ILIKE search');
      const ilikeFallback: Prisma.ProductWhereInput = {
        ...baseWhere,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      };
      const [products, count] = await this.prisma.$transaction([
        this.prisma.product.findMany({
          where: ilikeFallback,
          orderBy: this.buildOrderBy(sort),
          skip: offset,
          take: limit,
          include: this.listInclude(),
        }),
        this.prisma.product.count({ where: ilikeFallback }),
      ]);
      const data = await this.toListItems(products);
      await this.logSearch(q, count).catch(() => undefined);
      return paginatedResponse<ProductListItemDto>(data, page, limit, count);
    }

    // Fetch full product data for matched IDs (preserving rank order)
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: this.listInclude(),
    });

    // Re-order to match search rank
    const ordered = productIds
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean) as typeof products;

    const data = await this.toListItems(ordered);
    await this.logSearch(q, total).catch(() => undefined);

    return paginatedResponse<ProductListItemDto>(data, page, limit, total);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async buildWhereClause(query: SearchQueryDto): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = { isActive: true };

    if (query.category) {
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

  private buildOrderBy(sort?: ProductSortBy): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case ProductSortBy.PRICE_ASC: return { basePrice: 'asc' };
      case ProductSortBy.PRICE_DESC: return { basePrice: 'desc' };
      case ProductSortBy.BESTSELLER: return { soldCount: 'desc' };
      case ProductSortBy.FEATURED: return { isFeatured: 'desc' };
      default: return { createdAt: 'desc' };
    }
  }

  private buildRawOrderBy(sort?: ProductSortBy, relevanceExpr = 'ts_rank(p.search_vector, query)'): string {
    switch (sort) {
      case ProductSortBy.PRICE_ASC: return 'p."basePrice" ASC';
      case ProductSortBy.PRICE_DESC: return 'p."basePrice" DESC';
      case ProductSortBy.BESTSELLER: return 'p."soldCount" DESC';
      case ProductSortBy.FEATURED: return 'p."isFeatured" DESC, p."createdAt" DESC';
      default: return `${relevanceExpr} DESC, p."createdAt" DESC`;
    }
  }

  private listInclude() {
    return {
      category: { select: { id: true, name: true, slug: true } },
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
      _count: { select: { reviews: { where: { status: 'APPROVED' as const } } } },
    };
  }

  private async toListItems(
    products: {
      id: string; name: string; slug: string; sku: string;
      basePrice: unknown; compareAtPrice: unknown;
      images: { url: string }[];
      categoryId: string; category: { id: string; name: string; slug: string };
      isPersonalizable: boolean; isFeatured: boolean;
      viewCount: number; soldCount: number;
      _count: { reviews: number }; createdAt: Date;
    }[],
  ): Promise<ProductListItemDto[]> {
    return Promise.all(
      products.map(async (p) => ({
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
        averageRating: null, // skipped in list for performance; client fetches on demand
        reviewCount: p._count.reviews,
        inDemandCount: (await this.redis.get<number>(IN_DEMAND_KEY(p.id))) ?? 0,
        createdAt: p.createdAt,
      })),
    );
  }
}
