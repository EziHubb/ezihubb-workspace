import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BundleOfferResponseDto,
  CreateBundleOfferDto,
  UpdateBundleOfferDto,
} from './dto/bundle-offer.dto';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  basePrice: true,
  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
} as const;

@Injectable()
export class BundleOffersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBundleOfferDto, storeId: string): Promise<BundleOfferResponseDto> {
    const owned = await this.prisma.product.count({
      where: { id: { in: dto.productIds }, storeId },
    });
    if (owned !== dto.productIds.length) {
      throw new BadRequestException({
        code: 'ERR_BUNDLE_LISTINGS_INVALID',
        message: 'One or more selected listings do not belong to this store',
      });
    }

    const bundle = await this.prisma.bundleOffer.create({
      data: {
        storeId,
        discountPercent: dto.discountPercent,
        products: { create: dto.productIds.map((productId) => ({ productId })) },
      },
      include: { products: { include: { product: { select: PRODUCT_SELECT } } } },
    });

    return this.mapToDto(bundle);
  }

  async findAll(storeId: string): Promise<BundleOfferResponseDto[]> {
    const bundles = await this.prisma.bundleOffer.findMany({
      where: { storeId },
      include: { products: { include: { product: { select: PRODUCT_SELECT } } } },
      orderBy: { createdAt: 'desc' },
    });
    return bundles.map((b) => this.mapToDto(b));
  }

  async update(id: string, dto: UpdateBundleOfferDto, storeId: string): Promise<BundleOfferResponseDto> {
    const existing = await this.prisma.bundleOffer.findUnique({ where: { id } });
    if (!existing || existing.storeId !== storeId) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Bundle offer not found' });
    }

    if (dto.productIds) {
      const owned = await this.prisma.product.count({
        where: { id: { in: dto.productIds }, storeId },
      });
      if (owned !== dto.productIds.length) {
        throw new BadRequestException({
          code: 'ERR_BUNDLE_LISTINGS_INVALID',
          message: 'One or more selected listings do not belong to this store',
        });
      }
    }

    const bundle = await this.prisma.bundleOffer.update({
      where: { id },
      data: {
        ...(dto.discountPercent !== undefined && { discountPercent: dto.discountPercent }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.productIds !== undefined && {
          products: {
            deleteMany: {},
            create: dto.productIds.map((productId) => ({ productId })),
          },
        }),
      },
      include: { products: { include: { product: { select: PRODUCT_SELECT } } } },
    });

    return this.mapToDto(bundle);
  }

  async remove(id: string, storeId: string): Promise<void> {
    const existing = await this.prisma.bundleOffer.findUnique({ where: { id } });
    if (!existing || existing.storeId !== storeId) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Bundle offer not found' });
    }
    await this.prisma.bundleOffer.delete({ where: { id } });
  }

  /**
   * All active bundles that fully match a set of product IDs currently in cart
   * (a bundle only applies once every one of its listings is present together).
   */
  async findActiveMatchingBundles(storeId: string, cartProductIds: string[]) {
    const cartSet = new Set(cartProductIds);
    const bundles = await this.prisma.bundleOffer.findMany({
      where: { storeId, isActive: true },
      include: { products: { select: { productId: true } } },
    });
    // A bundle whose products cascade-deleted down to <2 listings (e.g. the
    // seller removed a product that was part of it) can no longer be "bought
    // together" — without this guard, `[].every(...)` is vacuously true and
    // Math.min(...[]) is Infinity, which would wrongly treat it as a match.
    return bundles.filter((b) => b.products.length >= 2 && b.products.every((p) => cartSet.has(p.productId)));
  }

  /** First active bundle this product belongs to — for the "Buy them together" card on the product detail page. */
  async findActiveBundleForProduct(productId: string): Promise<BundleOfferResponseDto | null> {
    const bundle = await this.prisma.bundleOffer.findFirst({
      where: { isActive: true, products: { some: { productId } } },
      include: { products: { include: { product: { select: PRODUCT_SELECT } } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!bundle || bundle.products.length < 2) return null;
    return this.mapToDto(bundle);
  }

  private mapToDto(bundle: {
    id: string;
    storeId: string;
    discountPercent: unknown;
    isActive: boolean;
    createdAt: Date;
    products: { product: { id: string; name: string; basePrice: unknown; images: { url: string }[] } }[];
  }): BundleOfferResponseDto {
    return {
      id: bundle.id,
      storeId: bundle.storeId,
      discountPercent: Number(bundle.discountPercent),
      isActive: bundle.isActive,
      createdAt: bundle.createdAt,
      products: bundle.products.map((p) => ({
        id: p.product.id,
        name: p.product.name,
        price: Number(p.product.basePrice),
        images: p.product.images.map((i) => i.url),
      })),
    };
  }
}
