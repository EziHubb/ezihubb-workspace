import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { RedisService, CacheKeys, CacheTtl } from '../../common/services/redis.service';
import { CategoryMenu } from './schemas/category-menu.schema';
import { ProductDetail } from './schemas/product-detail.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryResponseDto, CategoryChildDto, CategoryL3Dto } from './dto/category-response.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { CollectionResponseDto, TagResponseDto } from './dto/collection-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResult, paginatedResponse } from '../../common/dto/paginated-response.dto';
import { TranslationService } from '../translations/translation.service';
import { AutoTranslateService } from '../translations/auto-translate.service';
import type { SupportedLocale } from '../../common/utils/locale.util';

// re-exported for use in CollectionResponseDto.products
export type { CollectionResponseDto };

const MEGA_MENU_CACHE_KEY = 'catalog:mega_menu';
const MEGA_MENU_TTL = 600; // 10 minutes

/**
 * First occurrence wins, so the caller's ordering survives.
 *
 * CollectionProduct is keyed on (collectionId, productId), so a repeated id —
 * easy to produce by adding the same listing twice in the editor — would make
 * the whole write fail on a unique violation rather than being ignored.
 */
function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

/**
 * One row -> one DTO, shared by the storefront list and the admin list so the
 * two cannot drift into describing the same collection differently.
 */
type CollectionRow = Prisma.CollectionGetPayload<{ include: { _count: { select: { products: true } } } }>;

function toCollectionDto(c: CollectionRow): CollectionResponseDto {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    bannerUrl: c.bannerUrl,
    occasion: c.occasion,
    isActive: c.isActive,
    sortOrder: c.sortOrder,
    startDate: c.startDate,
    endDate: c.endDate,
    productCount: c._count.products,
    createdAt: c.createdAt,
  };
}
/** Mirrors what the collections editor offers and promises on screen. */
const COLLECTION_BANNER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const COLLECTION_BANNER_MAX_BYTES = 5 * 1024 * 1024;
@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectModel(CategoryMenu.name)
    private readonly categoryMenuModel: Model<CategoryMenu>,
    @InjectModel(ProductDetail.name)
    private readonly productDetailModel: Model<ProductDetail>,
    private readonly storageService: StorageService,
    private readonly translationService: TranslationService,
    private readonly autoTranslate: AutoTranslateService,
  ) {}

  // ─── Mega menu (MongoDB → Redis cache) ───────────────────────────────────

  async getMegaMenu(locale: SupportedLocale = 'en'): Promise<CategoryMenu[]> {
    let menus = await this.redis.get<CategoryMenu[]>(MEGA_MENU_CACHE_KEY);

    if (!menus) {
      menus = await this.categoryMenuModel
        .find({ isVisible: true })
        .sort({ sortOrder: 1 })
        .lean<CategoryMenu[]>()
        .exec();

      await this.redis.set(MEGA_MENU_CACHE_KEY, menus, MEGA_MENU_TTL);
    }

    if (locale === 'en') return menus;

    // Cache stores the English (source) tree; translate a copy per-request so
    // the cache stays locale-agnostic. categoryId at every level maps back to
    // a real Category row, so we reuse its `name` translations directly.
    const categoryIds = menus.flatMap((nav) => [
      nav.categoryId,
      ...nav.groups.flatMap((g) => [
        g.categoryId,
        ...g.items.map((item) => item.categoryId),
      ]),
    ]).filter(Boolean);

    const translations = await this.translationService.getBatchTranslations(
      'Category', categoryIds, locale,
    );
    const nameFor = (categoryId: string, fallback: string) =>
      translations[categoryId]?.['name'] ?? fallback;

    return menus.map((nav) => ({
      ...nav,
      navLabel: nameFor(nav.categoryId, nav.navLabel),
      groups: nav.groups.map((g) => ({
        ...g,
        title: nameFor(g.categoryId, g.title),
        items: g.items.map((item) => ({
          ...item,
          name: nameFor(item.categoryId, item.name),
        })),
      })),
    })) as CategoryMenu[];
  }

  // ─── Categories ────────────────────────────────────────────────────────────

  /**
   * Applies Category name/description translations to a tree (root → children →
   * grandchildren) fetched from cache or DB in English. Cache stays locale-agnostic;
   * translation happens per-request on top of it, same pattern as getMegaMenu().
   */
  private async translateCategoryTree(
    tree: CategoryResponseDto[],
    locale: SupportedLocale,
  ): Promise<CategoryResponseDto[]> {
    if (locale === 'en') return tree;

    const ids = tree.flatMap((c) => [
      c.id,
      ...(c.children ?? []).flatMap((child) => [
        child.id,
        ...(child.children ?? []).map((gc) => gc.id),
      ]),
    ]);

    const translations = await this.translationService.getBatchTranslations('Category', ids, locale);
    const apply = <T extends { id: string; name: string; description?: string | null }>(node: T): T => ({
      ...node,
      name:        translations[node.id]?.['name'] ?? node.name,
      description: (translations[node.id]?.['description'] ?? node.description) as T['description'],
    });

    return tree.map((c) => ({
      ...apply(c),
      children: (c.children ?? []).map((child) => ({
        ...apply(child),
        children: (child.children ?? []).map((gc) => apply(gc)),
      })),
    }));
  }

  async getCategories(locale: SupportedLocale = 'en'): Promise<CategoryResponseDto[]> {
    const cached = await this.redis.get<CategoryResponseDto[]>(CacheKeys.categoriesTree());
    if (cached) return this.translateCategoryTree(cached, locale);

    const categories = await this.prisma.category.findMany({
      where: { isVisible: true },
      include: {
        children: {
          where: { isVisible: true },
          include: {
            children: {
              where: { isVisible: true },
              include: { _count: { select: { products: { where: { isActive: true } } } } },
              orderBy: { sortOrder: 'asc' },
            },
            _count: { select: { products: { where: { isActive: true } } } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Build tree: root categories only (parentId === null)
    const tree = categories
      .filter((c) => c.parentId === null)
      .map((cat): CategoryResponseDto => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        sortOrder: cat.sortOrder,
        isVisible: cat.isVisible,
        parentId: cat.parentId,
        productCount: cat._count.products,
        createdAt: cat.createdAt,
        children: cat.children.map((child): CategoryChildDto => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          imageUrl: child.imageUrl,
          sortOrder: child.sortOrder,
          productCount: child._count.products,
          children: child.children.map((gc): CategoryL3Dto => ({
            id: gc.id,
            name: gc.name,
            slug: gc.slug,
            imageUrl: gc.imageUrl,
            sortOrder: gc.sortOrder,
            productCount: gc._count.products,
          })),
        })),
      }));

    await this.redis.set(CacheKeys.categoriesTree(), tree, CacheTtl.long);
    return this.translateCategoryTree(tree, locale);
  }

  async getCategoryBySlug(slug: string, locale: SupportedLocale = 'en'): Promise<CategoryResponseDto> {
    const cat = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        children: {
          where: { isVisible: true },
          include: { _count: { select: { products: { where: { isActive: true } } } } },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });

    if (!cat || !cat.isVisible) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Category not found' });
    }

    const result: CategoryResponseDto = {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      sortOrder: cat.sortOrder,
      isVisible: cat.isVisible,
      parentId: cat.parentId,
      productCount: cat._count.products,
      createdAt: cat.createdAt,
      children: cat.children.map((child): CategoryChildDto => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        imageUrl: child.imageUrl,
        sortOrder: child.sortOrder,
        productCount: child._count.products,
        children: [],
      })),
    };

    const [translated] = await this.translateCategoryTree([result], locale);
    return translated ?? result;
  }

  async createCategory(dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name, 'category');

    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException({ code: 'ERR_NOT_FOUND', message: 'Parent category not found' });
      // level guard — only enforced after migration adds the level column
      const parentLevel = (parent as Record<string, unknown>)['level'] as number | undefined;
      if (parentLevel !== undefined && parentLevel >= 3) {
        throw new BadRequestException({ code: 'ERR_CATEGORY_DEPTH', message: 'Categories support max 3 levels (nav tab → group → item)' });
      }
    }

    // Compute level from parent (graceful — field may not exist before migration)
    let level = 1;
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: dto.parentId } });
      const parentLevel = (parent as Record<string, unknown> | null)?.['level'] as number | undefined;
      level = (parentLevel ?? 1) + 1;
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        parentId: dto.parentId,
        ...(level !== undefined && { level }),
        sortOrder: dto.sortOrder ?? 0,
        isVisible: dto.isVisible ?? true,
      },
      include: {
        children: true,
        _count: { select: { products: true } },
      },
    });

    await Promise.all([
      this.redis.del(CacheKeys.categoriesTree()),
      this.invalidateMenuCache(),
    ]);

    this.autoTranslate.triggerTranslation('Category', category.id, {
      name: category.name,
      description: category.description ?? '',
    });

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      isVisible: category.isVisible,
      parentId: category.parentId,
      productCount: 0,
      createdAt: category.createdAt,
      children: [],
    };
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<CategoryResponseDto> {
    await this.requireCategory(id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.imageUrl !== undefined) data['imageUrl'] = dto.imageUrl;
    if (dto.sortOrder !== undefined) data['sortOrder'] = dto.sortOrder;
    if (dto.isVisible !== undefined) data['isVisible'] = dto.isVisible;
    if (dto.parentId !== undefined) data['parentId'] = dto.parentId;

    if (dto.slug !== undefined) {
      const existing = await this.prisma.category.findFirst({ where: { slug: dto.slug, NOT: { id } } });
      if (existing) throw new ConflictException({ code: 'ERR_SLUG_TAKEN', message: 'Slug is already in use' });
      data['slug'] = dto.slug;
    } else if (dto.name !== undefined) {
      data['slug'] = await this.resolveUniqueSlug(dto.name, 'category', id);
    }

    const category = await this.prisma.category.update({
      where: { id },
      data,
      include: {
        children: {
          include: { _count: { select: { products: { where: { isActive: true } } } } },
        },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });

    await Promise.all([
      this.redis.del(CacheKeys.categoriesTree()),
      this.invalidateMenuCache(),
    ]);

    if (dto.name !== undefined || dto.description !== undefined) {
      this.autoTranslate.triggerTranslation('Category', category.id, {
        name: category.name,
        description: category.description ?? '',
      }, true);
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      isVisible: category.isVisible,
      parentId: category.parentId,
      productCount: category._count.products,
      createdAt: category.createdAt,
      children: category.children.map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug,
        imageUrl: child.imageUrl,
        sortOrder: child.sortOrder,
        productCount: child._count.products,
        children: [],
      })),
    };
  }

  async deleteCategory(id: string): Promise<void> {
    await this.requireCategory(id);

    const activeProductCount = await this.prisma.product.count({
      where: { categoryId: id, isActive: true },
    });

    if (activeProductCount > 0) {
      throw new BadRequestException({
        code: 'ERR_CATEGORY_HAS_PRODUCTS',
        message: `Cannot delete category with ${activeProductCount} active product(s). Reassign or deactivate them first.`,
      });
    }

    await this.prisma.category.delete({ where: { id } });
    await Promise.all([
      this.redis.del(CacheKeys.categoriesTree()),
      this.invalidateMenuCache(),
      this.translationService.deleteEntityTranslations('Category', id),
    ]);
  }

  // ─── Collections ───────────────────────────────────────────────────────────

  async getCollections(filters: {
    isActive?: boolean;
    occasion?: string;
  } = {}): Promise<CollectionResponseDto[]> {
    const now = new Date();
    const where: Record<string, unknown> = {};

    if (filters.isActive !== undefined) {
      where['isActive'] = filters.isActive;
    }

    if (filters.occasion) {
      where['occasion'] = filters.occasion;
    }

    // Only show collections within their date range (if dates are set)
    where['AND'] = [
      { OR: [{ startDate: null }, { startDate: { lte: now } }] },
      { OR: [{ endDate: null }, { endDate: { gte: now } }] },
    ];

    const collections = await this.prisma.collection.findMany({
      where,
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: 'asc' },
    });

    return collections.map(toCollectionDto);
  }

  /**
   * The admin list: paginated, searchable, and NOT limited to the live window.
   *
   * Separate from getCollections() for two reasons, both of which the seller
   * screen depends on.
   *
   * It returns { data, total, pages } rather than a bare array. The admin page
   * has always read data.data / data.total / data.pages while this endpoint
   * answered with an array — so `data.data` was undefined, safeArr made it an
   * empty list, and the page reported "0 collections total" over a database
   * that had plenty. api.get<T>() is typed by its caller, so TypeScript
   * asserted a shape that never existed and never said a word.
   *
   * And it drops the date-window filter. getCollections() hides anything
   * outside its start/end dates, which is right for a storefront and wrong
   * here: this screen has a DATE RANGE column and a status filter, both of
   * which exist to manage collections that are scheduled or finished.
   *
   * The q / occasion / isActive / page params were already being sent by the
   * page and silently ignored, so the filters above the table did nothing.
   */
  async getCollectionsAdmin(filters: {
    page?:     number;
    limit?:    number;
    q?:        string;
    occasion?: string;
    isActive?: boolean;
  } = {}): Promise<{ data: CollectionResponseDto[]; total: number; pages: number }> {
    const page  = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const where: Prisma.CollectionWhereInput = {
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.occasion ? { occasion: filters.occasion } : {}),
      ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.collection.findMany({
        where,
        include: { _count: { select: { products: true } } },
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.collection.count({ where }),
    ]);

    return {
      data:  rows.map(toCollectionDto),
      total,
      // At least 1, so the pager reads "Page 1 of 1" on an empty list rather
      // than "Page 1 of 0".
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getCollectionBySlug(
    slug: string,
    pagination: PaginationDto,
    locale: SupportedLocale = 'en',
  ): Promise<CollectionResponseDto & { products: PaginatedResult<{ id: string; name: string; slug: string; imageUrl: string | null; basePrice: number }> }> {
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
      include: { _count: { select: { products: true } } },
    });

    if (!collection || !collection.isActive) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Collection not found' });
    }

    const [collectionProducts, total] = await this.prisma.$transaction([
      this.prisma.collectionProduct.findMany({
        where: { collectionId: collection.id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              basePrice: true,
              images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.collectionProduct.count({ where: { collectionId: collection.id } }),
    ]);

    const [collectionTranslation, productTranslations] = await Promise.all([
      this.translationService.getTranslations('Collection', collection.id, locale),
      this.translationService.getBatchTranslations(
        'Product', collectionProducts.map((cp) => cp.product.id), locale,
      ),
    ]);

    const productItems = collectionProducts.map((cp) => ({
      id: cp.product.id,
      name: productTranslations[cp.product.id]?.['name'] ?? cp.product.name,
      slug: cp.product.slug,
      imageUrl: cp.product.images[0]?.url ?? null,
      basePrice: Number(cp.product.basePrice),
    }));

    return {
      id: collection.id,
      name: collectionTranslation['name'] ?? collection.name,
      slug: collection.slug,
      description: collectionTranslation['description'] ?? collection.description,
      bannerUrl: collection.bannerUrl,
      occasion: collection.occasion,
      isActive: collection.isActive,
      sortOrder: collection.sortOrder,
      startDate: collection.startDate,
      endDate: collection.endDate,
      productCount: collection._count.products,
      createdAt: collection.createdAt,
      products: paginatedResponse(productItems, pagination.page ?? 1, pagination.limit ?? 24, total),
    };
  }

  async createCollection(dto: CreateCollectionDto): Promise<CollectionResponseDto> {
    const slug = await this.resolveUniqueSlug(dto.slug ?? dto.name, 'collection');

    const collection = await this.prisma.collection.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        bannerUrl: dto.bannerUrl,
        occasion: dto.occasion,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        // Array position is the display order. Created inline so a collection
        // and its listings arrive in one write — the editor sends both at once
        // and a half-created collection is not a state worth being able to
        // reach.
        ...(dto.productIds?.length
          ? {
              products: {
                create: dedupe(dto.productIds).map((productId, i) => ({ productId, sortOrder: i })),
              },
            }
          : {}),
      },
      include: { _count: { select: { products: true } } },
    });

    this.autoTranslate.triggerTranslation('Collection', collection.id, {
      name: collection.name,
      description: collection.description ?? '',
    });

    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      bannerUrl: collection.bannerUrl,
      occasion: collection.occasion,
      isActive: collection.isActive,
      sortOrder: collection.sortOrder,
      startDate: collection.startDate,
      endDate: collection.endDate,
      productCount: collection._count.products,
      createdAt: collection.createdAt,
    };
  }

  /**
   * Stores a banner and hands back its URL. It does not touch any collection.
   *
   * Upload-then-save, rather than a POST to /collections/:id/banner like the
   * store one: a collection being created has no id yet, and making the editor
   * save first just to attach a picture would be a worse form for the sake of
   * a tidier route. The URL comes back, the field goes in the payload, and
   * create and update handle it identically. Clearing the field is the delete
   * — updateCollection writes bannerUrl through when it is explicitly null.
   */
  async uploadCollectionBanner(file: Express.Multer.File): Promise<{ url: string }> {
    /**
     * Checked here as well as in the form, because a check the caller can
     * skip is not a check. The editor refuses the wrong file for a faster
     * answer; this refuses it because the endpoint has to.
     *
     * No other upload in this codebase does either, which is worth knowing
     * and is not fixed here — it would mean touching every one of them.
     */
    if (!COLLECTION_BANNER_TYPES.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'ERR_UNSUPPORTED_IMAGE',
        message: 'Banner must be a PNG, JPG or WebP image',
      });
    }
    if (file.size > COLLECTION_BANNER_MAX_BYTES) {
      throw new BadRequestException({
        code: 'ERR_FILE_TOO_LARGE',
        message: `Banner must be under ${COLLECTION_BANNER_MAX_BYTES / (1024 * 1024)} MB`,
      });
    }

    const key = this.storageService.generateKey('collections', file.originalname);
    const url = await this.storageService.uploadFile(file.buffer, key, file.mimetype);
    return { url };
  }

  async updateCollection(id: string, dto: UpdateCollectionDto): Promise<CollectionResponseDto> {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Collection not found' });

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data['name'] = dto.name;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.bannerUrl !== undefined) data['bannerUrl'] = dto.bannerUrl;
    if (dto.occasion !== undefined) data['occasion'] = dto.occasion;
    if (dto.isActive !== undefined) data['isActive'] = dto.isActive;
    if (dto.sortOrder !== undefined) data['sortOrder'] = dto.sortOrder;
    if (dto.startDate !== undefined) data['startDate'] = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) data['endDate'] = dto.endDate ? new Date(dto.endDate) : null;

    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      const taken = await this.prisma.collection.findFirst({ where: { slug: dto.slug, NOT: { id } } });
      if (taken) throw new ConflictException({ code: 'ERR_SLUG_TAKEN', message: 'Slug is already in use' });
      data['slug'] = dto.slug;
    } else if (dto.name !== undefined) {
      data['slug'] = await this.resolveUniqueSlug(dto.name, 'collection', id);
    }

    // Replace-the-set, in one transaction with the field update: the editor
    // always holds the complete list, so "add these" has no meaning — and a
    // delete that lands without its matching create would empty a live
    // collection on the storefront.
    //
    // undefined means the caller said nothing about products, which is what a
    // PATCH from anywhere but this editor looks like.
    const collection = await this.prisma.$transaction(async (tx) => {
      if (dto.productIds !== undefined) {
        await tx.collectionProduct.deleteMany({ where: { collectionId: id } });
        if (dto.productIds.length > 0) {
          await tx.collectionProduct.createMany({
            data: dedupe(dto.productIds).map((productId, i) => ({ collectionId: id, productId, sortOrder: i })),
            skipDuplicates: true,
          });
        }
      }

      return tx.collection.update({
        where: { id },
        data,
        include: { _count: { select: { products: true } } },
      });
    });

    if (dto.name !== undefined || dto.description !== undefined) {
      this.autoTranslate.triggerTranslation('Collection', collection.id, {
        name: collection.name,
        description: collection.description ?? '',
      }, true);
    }

    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      bannerUrl: collection.bannerUrl,
      occasion: collection.occasion,
      isActive: collection.isActive,
      sortOrder: collection.sortOrder,
      startDate: collection.startDate,
      endDate: collection.endDate,
      productCount: collection._count.products,
      createdAt: collection.createdAt,
    };
  }

  async deleteCollection(id: string): Promise<void> {
    const existing = await this.prisma.collection.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Collection not found' });
    await this.prisma.collection.delete({ where: { id } });
    await this.translationService.deleteEntityTranslations('Collection', id);
  }

  // ─── Tags ──────────────────────────────────────────────────────────────────

  async getAllTags(): Promise<TagResponseDto[]> {
    const TAGS_CACHE_KEY = 'catalog:tags';
    const cached = await this.redis.get<TagResponseDto[]>(TAGS_CACHE_KEY);
    if (cached) return cached;

    const tags = await this.prisma.tag.findMany({
      include: { _count: { select: { products: { where: { product: { isActive: true } } } } } },
      orderBy: { name: 'asc' },
    });

    const result = tags.map((t): TagResponseDto => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      productCount: t._count.products,
    }));

    await this.redis.set(TAGS_CACHE_KEY, result, CacheTtl.medium);
    return result;
  }

  // ─── Filterable attributes (for dynamic FilterSidebar) ────────────────────

  /**
   * Returns all unique filterable attributes for products in a category.
   * Powers the FilterSidebar's category-specific attribute filters.
   * Example response for "Cutting Boards":
   *   { attributes: [{ key: "Material", values: ["Bamboo", "Walnut"] }, ...] }
   */
  async getFilterableAttributes(
    categorySlug: string,
  ): Promise<{ attributes: { key: string; values: string[] }[] }> {
    const category = await this.prisma.category.findUnique({
      where:  { slug: categorySlug },
      select: { id: true },
    });
    if (!category) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Category not found' });
    }

    // Always include products from direct children (handles both L2 groups and L3 leaves)
    const children = await this.prisma.category.findMany({
      where:  { parentId: category.id },
      select: { id: true },
    });
    const categoryIds: string[] = [category.id, ...children.map((c) => c.id)];

    const products = await this.prisma.product.findMany({
      where:  { categoryId: { in: categoryIds }, isActive: true },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    if (productIds.length === 0) return { attributes: [] };

    const result = await this.productDetailModel.aggregate([
      { $match: { productId: { $in: productIds } } },
      { $unwind: '$attributes' },
      { $match: { 'attributes.filterable': true } },
      {
        $group: {
          _id:    '$attributes.key',
          values: { $addToSet: '$attributes.value' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id:    0,
          key:    '$_id',
          values: { $sortArray: { input: '$values', sortBy: 1 } },
        },
      },
    ]);

    return { attributes: result as { key: string; values: string[] }[] };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  async invalidateMenuCache(): Promise<void> {
    await this.redis.del(MEGA_MENU_CACHE_KEY);
  }

  private async requireCategory(id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Category not found' });
  }

  /** Generates a unique slug, appending -2, -3 etc. if needed. Excludes excludeId to allow same-entity updates. */
  private async resolveUniqueSlug(
    source: string,
    type: 'category' | 'collection',
    excludeId?: string,
  ): Promise<string> {
    const base = this.slugify(source);

    const findExisting = async (slug: string) => {
      if (type === 'category') {
        return this.prisma.category.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } });
      }
      return this.prisma.collection.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } });
    };

    let slug = base;
    let counter = 2;

    while (await findExisting(slug)) {
      slug = `${base}-${counter}`;
      counter++;
    }

    return slug;
  }

  // ─── Admin helpers ─────────────────────────────────────────────────────────

  async getAdminCategoryById(id: string): Promise<CategoryResponseDto> {
    const cat = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!cat) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Category not found' });
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      sortOrder: cat.sortOrder,
      isVisible: cat.isVisible,
      parentId: cat.parentId,
      level: (cat as Record<string, unknown>)['level'] as number | undefined,
      productCount: cat._count.products,
      createdAt: cat.createdAt,
      children: [],
    } as CategoryResponseDto;
  }

  async getAdminCategories(limit = 500): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      take: limit,
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }],
    });

    return categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      sortOrder: cat.sortOrder,
      isVisible: cat.isVisible,
      parentId: cat.parentId,
      level: (cat as Record<string, unknown>)['level'] as number | undefined,
      productCount: cat._count.products,
      createdAt: cat.createdAt,
      children: [],
    })) as CategoryResponseDto[];
  }

  async syncMegaMenu(): Promise<{ synced: number }> {
    const categories = await this.prisma.category.findMany({
      where: { isVisible: true },
      orderBy: [{ sortOrder: 'asc' }],
    });

    const byLevel = (lvl: number) =>
      categories.filter((c) => (c as Record<string, unknown>)['level'] === lvl);

    const l1 = byLevel(1);
    const l2 = byLevel(2);
    const l3 = byLevel(3);

    await this.categoryMenuModel.deleteMany({});

    const menus = l1.map((nav) => ({
      navLabel: nav.name,
      navSlug: nav.slug,
      categoryId: nav.id,
      sortOrder: nav.sortOrder,
      isVisible: nav.isVisible,
      groups: l2
        .filter((g) => g.parentId === nav.id)
        .map((group) => ({
          title: group.name,
          categoryId: group.id,
          slug: group.slug,
          sortOrder: group.sortOrder,
          items: l3
            .filter((item) => item.parentId === group.id)
            .map((item) => ({
              name: item.name,
              categoryId: item.id,
              slug: item.slug,
              sortOrder: item.sortOrder,
            })),
        })),
    }));

    if (menus.length > 0) {
      await this.categoryMenuModel.insertMany(menus);
    }
    await this.redis.del(MEGA_MENU_CACHE_KEY);

    return { synced: menus.length };
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
}
