import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RedisService,
  CacheKeys,
  CacheTtl,
} from '../../common/services/redis.service';
import { SearchQueryDto, SearchSortBy, ItemType } from './dto/search-query.dto';
import { ProductSortBy } from '../products/dto/product-query.dto';
import { ProductListItemDto } from '../products/dto/product-list-item.dto';
import {
  PaginatedResult,
  paginatedResponse,
} from '../../common/dto/paginated-response.dto';
import { ProductDetail } from '../catalog/schemas/product-detail.schema';
import { AnalyticsService } from '../analytics/analytics.service';

const TRENDING_KEY = 'search:trending';
const TRENDING_WINDOW_DAYS = 7;
const IN_DEMAND_KEY = (productId: string) => `product:demand:${productId}`;

export interface FacetItem {
  value: string;
  count: number;
}

export interface SearchFacets {
  freeShipping: number;
  onSale: number;
  colors: FacetItem[];
  materials: FacetItem[];
  styles: FacetItem[];
  occasion: FacetItem[];
  holiday: FacetItem[];
  recipient: FacetItem[];
}

export interface SearchResultDto extends PaginatedResult<ProductListItemDto> {
  facets: SearchFacets;
  appliedFilters: Record<string, unknown>;
  correctedQuery: string | null;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly analyticsService: AnalyticsService,
    @InjectModel(ProductDetail.name)
    private readonly productDetailModel: Model<ProductDetail>,
  ) {}

  // ─── Full-text search ──────────────────────────────────────────────────────

  async search(query: SearchQueryDto): Promise<SearchResultDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 48;

    const where = await this.buildWhereClause(query);

    let paginatedResult: PaginatedResult<ProductListItemDto>;

    if (query.q) {
      paginatedResult = await this.fullTextSearch(query.q, where, page, limit, query.sort);
    } else {
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
      await this.logSearch('', total).catch(() => undefined);
      paginatedResult = paginatedResponse<ProductListItemDto>(data, page, limit, total);
    }

    const facets = await this.computeFacets(where);
    const appliedFilters = this.extractAppliedFilters(query);

    // Fire-and-forget analytics tracking for zero-result detection and trending
    if (query.q) {
      this.analyticsService
        .trackSearch(query.q, paginatedResult.pagination.total)
        .catch(() => undefined);
    }

    return { ...paginatedResult, facets, appliedFilters, correctedQuery: null };
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

    const ttl = await client.ttl(TRENDING_KEY);
    if (ttl < 0) {
      await client.expire(TRENDING_KEY, TRENDING_WINDOW_DAYS * 24 * 3600);
    }

    this.logger.debug(`Search logged: "${clean}" → ${resultCount} results`);
  }

  // ─── Related searches ──────────────────────────────────────────────────────

  async getRelated(q: string): Promise<string[]> {
    const clean = q.trim().toLowerCase();
    if (!clean) return [];

    const trending = await this.getTrending();
    const queryWords = new Set(clean.split(/\s+/));

    const related = trending.filter((keyword) => {
      if (keyword === clean) return false;
      const words = keyword.split(/\s+/);
      return words.some((w) => queryWords.has(w) || clean.includes(w) || w.includes(clean));
    });

    if (related.length < 5) {
      const rest = trending.filter((k) => k !== clean && !related.includes(k));
      return [...related, ...rest].slice(0, 8);
    }

    return related.slice(0, 8);
  }

  // ─── Private: full-text search via raw SQL ─────────────────────────────────

  private async fullTextSearch(
    q: string,
    baseWhere: Prisma.ProductWhereInput,
    page: number,
    limit: number,
    sort?: SearchSortBy,
  ): Promise<PaginatedResult<ProductListItemDto>> {
    const offset = (page - 1) * limit;

    const whereParts: string[] = [
      `p."isActive" = true`,
      `p."deletedAt" IS NULL`,
    ];

    if (baseWhere.categoryId && typeof baseWhere.categoryId === 'string') {
      whereParts.push(`p."categoryId" = '${baseWhere.categoryId}'`);
    }

    if (baseWhere.basePrice) {
      const priceFilter = baseWhere.basePrice as { gte?: number; lte?: number };
      if (priceFilter.gte !== undefined) {
        whereParts.push(`p."basePrice" >= ${priceFilter.gte}`);
      }
      if (priceFilter.lte !== undefined) {
        whereParts.push(`p."basePrice" <= ${priceFilter.lte}`);
      }
    }

    if (baseWhere.compareAtPrice && (baseWhere.compareAtPrice as { not?: null }).not === null) {
      whereParts.push(`p."compareAtPrice" IS NOT NULL`);
    }

    if (typeof (baseWhere.soldCount as { gte?: number } | undefined)?.gte === 'number') {
      whereParts.push(`p."soldCount" >= ${(baseWhere.soldCount as { gte: number }).gte}`);
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

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: this.listInclude(),
    });

    const ordered = productIds
      .map((id) => products.find((p) => p.id === id))
      .filter(Boolean) as typeof products;

    const data = await this.toListItems(ordered);
    await this.logSearch(q, total).catch(() => undefined);

    return paginatedResponse<ProductListItemDto>(data, page, limit, total);
  }

  // ─── Private: facets ───────────────────────────────────────────────────────

  private async computeFacets(where: Prisma.ProductWhereInput): Promise<SearchFacets> {
    const empty: SearchFacets = {
      freeShipping: 0, onSale: 0,
      colors: [], materials: [], styles: [],
      occasion: [], holiday: [], recipient: [],
    };
    try {
      const matching = await this.prisma.product.findMany({
        where,
        select: { id: true },
        take: 500,
      });
      const ids = matching.map((p) => p.id);
      if (!ids.length) return empty;

      const [colors, materials, styles, occasion, holiday, recipient, countsRaw] =
        await Promise.all([
          this.prisma.$queryRaw<FacetItem[]>(Prisma.sql`
            SELECT unnest("primaryColors") AS value, COUNT(*)::int AS count
            FROM "Product" WHERE id = ANY(${ids})
            GROUP BY value ORDER BY count DESC LIMIT 15
          `),
          this.prisma.$queryRaw<FacetItem[]>(Prisma.sql`
            SELECT unnest(materials) AS value, COUNT(*)::int AS count
            FROM "Product" WHERE id = ANY(${ids})
            GROUP BY value ORDER BY count DESC LIMIT 15
          `),
          this.prisma.$queryRaw<FacetItem[]>(Prisma.sql`
            SELECT unnest(styles) AS value, COUNT(*)::int AS count
            FROM "Product" WHERE id = ANY(${ids})
            GROUP BY value ORDER BY count DESC LIMIT 15
          `),
          this.prisma.$queryRaw<FacetItem[]>(Prisma.sql`
            SELECT unnest(occasions) AS value, COUNT(*)::int AS count
            FROM "Product" WHERE id = ANY(${ids})
            GROUP BY value ORDER BY count DESC LIMIT 13
          `),
          this.prisma.$queryRaw<FacetItem[]>(Prisma.sql`
            SELECT unnest("holidayTags") AS value, COUNT(*)::int AS count
            FROM "Product" WHERE id = ANY(${ids})
            GROUP BY value ORDER BY count DESC LIMIT 15
          `),
          this.prisma.$queryRaw<FacetItem[]>(Prisma.sql`
            SELECT unnest("recipientTags") AS value, COUNT(*)::int AS count
            FROM "Product" WHERE id = ANY(${ids})
            GROUP BY value ORDER BY count DESC LIMIT 10
          `),
          this.prisma.$queryRaw<Array<{ freeShipping: number; onSale: number }>>(Prisma.sql`
            SELECT
              COUNT(CASE WHEN "compareAtPrice" IS NOT NULL THEN 1 END)::int AS "onSale",
              COUNT(CASE WHEN EXISTS (
                SELECT 1 FROM "ProductTag" pt
                JOIN "Tag" tg ON tg.id = pt."tagId"
                WHERE pt."productId" = p.id AND tg.slug = 'free-shipping'
              ) THEN 1 END)::int AS "freeShipping"
            FROM "Product" p WHERE p.id = ANY(${ids})
          `),
        ]);

      const counts = countsRaw[0] ?? { freeShipping: 0, onSale: 0 };
      return { ...counts, colors, materials, styles, occasion, holiday, recipient };
    } catch (err) {
      this.logger.warn('Facet computation failed', err);
      return empty;
    }
  }

  // ─── Private: applied filters ──────────────────────────────────────────────

  private extractAppliedFilters(query: SearchQueryDto): Record<string, unknown> {
    const filters: Record<string, unknown> = {};
    if (query.q)                           filters['q']            = query.q;
    if (query.category)                    filters['category']     = query.category;
    if (query.collection)                  filters['collection']   = query.collection;
    if (query.tags?.length)               filters['tags']         = query.tags;
    if (query.minPrice !== undefined)      filters['minPrice']     = query.minPrice;
    if (query.maxPrice !== undefined)      filters['maxPrice']     = query.maxPrice;
    if (query.minRating !== undefined)     filters['minRating']    = query.minRating;
    if (query.itemType)                    filters['itemType']     = query.itemType;
    if (query.freeShipping)               filters['freeShipping'] = true;
    if (query.onSale)                      filters['onSale']       = true;
    if (query.starSeller)                  filters['starSeller']   = true;
    if (query.colors)                      filters['colors']       = query.colors;
    if (query.attr && Object.keys(query.attr).length) filters['attr'] = query.attr;
    return filters;
  }

  // ─── Private: where clause ─────────────────────────────────────────────────

  private async buildWhereClause(
    query: SearchQueryDto,
  ): Promise<Prisma.ProductWhereInput> {
    const where: Prisma.ProductWhereInput = { isActive: true };
    const andConditions: Prisma.ProductWhereInput[] = [];

    if (query.category) {
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
      andConditions.push({ tags: { some: { tag: { slug: { in: query.tags } } } } });
    }

    if (query.freeShipping) {
      andConditions.push({ tags: { some: { tag: { slug: 'free-shipping' } } } });
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.basePrice = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }

    if (query.onSale) {
      where.compareAtPrice = { not: null };
    }

    if (query.starSeller) {
      where.soldCount = { gte: 50 };
    }

    if (query.itemType === ItemType.READY_TO_SHIP) {
      where.quantity = { gt: 0 };
    } else if (query.itemType === ItemType.TO_ORDER) {
      where.quantity = { equals: null };
    }

    if (query.colors) {
      const colorList = query.colors.split(',').map((c) => c.trim()).filter(Boolean);
      if (colorList.length) {
        where.primaryColors = { hasSome: colorList };
      }
    }

    if (query.minRating !== undefined) {
      andConditions.push({
        reviews: { some: { status: 'APPROVED', rating: { gte: query.minRating } } },
      });
    }

    // Attribute filters: query MongoDB for matching productIds
    if (query.attr && Object.keys(query.attr).length) {
      const attrEntries = Object.entries(query.attr);
      const matchConditions = attrEntries.map(([key, value]) => ({
        attributes: { $elemMatch: { key, value } },
      }));

      const matchingDetails = await this.productDetailModel
        .find({ $and: matchConditions }, { productId: 1 })
        .lean()
        .exec();

      const mongoIds = (matchingDetails as unknown as Array<{ productId: string }>).map(
        (d) => d.productId,
      );
      where.id = { in: mongoIds };
    }

    if (andConditions.length) {
      where.AND = andConditions;
    }

    return where;
  }

  private buildOrderBy(
    sort?: SearchSortBy,
  ): Prisma.ProductOrderByWithRelationInput {
    switch (sort) {
      case SearchSortBy.PRICE_ASC:  return { basePrice: 'asc' };
      case SearchSortBy.PRICE_DESC: return { basePrice: 'desc' };
      case SearchSortBy.BESTSELLER: return { soldCount: 'desc' };
      case SearchSortBy.FEATURED:   return { isFeatured: 'desc' };
      case SearchSortBy.RATING:     return { soldCount: 'desc' };
      default:                      return { createdAt: 'desc' };
    }
  }

  private buildRawOrderBy(
    sort?: SearchSortBy,
    relevanceExpr = 'ts_rank(p.search_vector, query)',
  ): string {
    switch (sort) {
      case SearchSortBy.PRICE_ASC:  return 'p."basePrice" ASC';
      case SearchSortBy.PRICE_DESC: return 'p."basePrice" DESC';
      case SearchSortBy.BESTSELLER: return 'p."soldCount" DESC';
      case SearchSortBy.FEATURED:   return 'p."isFeatured" DESC, p."createdAt" DESC';
      case SearchSortBy.RATING:     return 'p."soldCount" DESC';
      default:                      return `${relevanceExpr} DESC, p."createdAt" DESC`;
    }
  }

  private listInclude() {
    return {
      category: { select: { id: true, name: true, slug: true } },
      images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
      _count: {
        select: { reviews: { where: { status: 'APPROVED' as const } } },
      },
    };
  }

  private async toListItems(
    products: {
      id: string;
      name: string;
      slug: string;
      sku: string;
      basePrice: unknown;
      compareAtPrice: unknown;
      images: { url: string }[];
      categoryId: string;
      category: { id: string; name: string; slug: string };
      isPersonalizable: boolean;
      isFeatured: boolean;
      viewCount: number;
      soldCount: number;
      _count: { reviews: number };
      createdAt: Date;
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
        averageRating: null,
        reviewCount: p._count.reviews,
        inDemandCount: (await this.redis.get<number>(IN_DEMAND_KEY(p.id))) ?? 0,
        createdAt: p.createdAt,
      })),
    );
  }
}
