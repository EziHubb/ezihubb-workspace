import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { RedisService } from '../../common/services/redis.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { UpdateWishlistShareDto } from './dto/update-wishlist-share.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { AddressResponseDto } from './dto/address-response.dto';
import { WishlistItemResponseDto } from './dto/wishlist-item-response.dto';
import { PaginatedResult, paginatedResponse } from '../../common/dto/paginated-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

const MAX_ADDRESSES = 10;
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_ALLOWED_MIMETYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly redis: RedisService,
  ) {}

  // ─── Profile ───────────────────────────────────────────────────────────────

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'User not found' });
    return UserResponseDto.fromPrisma(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      },
    });
    return UserResponseDto.fromPrisma(user);
  }

  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    if (!file) {
      throw new BadRequestException({
        code: 'ERR_MISSING_FILE',
        message: 'Avatar file is required — send it as the "avatar" field in a multipart/form-data request',
      });
    }

    if (!AVATAR_ALLOWED_MIMETYPES.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'ERR_INVALID_FILE_TYPE',
        message: 'Avatar must be a JPEG, PNG, or WebP image',
      });
    }

    if (file.size > AVATAR_MAX_BYTES) {
      throw new BadRequestException({
        code: 'ERR_FILE_TOO_LARGE',
        message: 'Avatar must be smaller than 5 MB',
      });
    }

    // Delete old avatar if it exists
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (existing?.avatarUrl) {
      const oldKey = this.storage.extractKey(existing.avatarUrl);
      await this.storage.deleteFile(oldKey).catch((err) =>
        this.logger.warn(`Failed to delete old avatar: ${err.message}`),
      );
    }

    const key = this.storage.generateKey(`avatars/${userId}`, file.originalname);
    await this.storage.uploadFile(file.buffer, key, file.mimetype);
    const avatarUrl = this.storage.getPublicUrl(key);

    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    await this.redis.del(`user:${userId}`);

    return { avatarUrl };
  }

  async deleteAvatar(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (user?.avatarUrl) {
      const key = this.storage.extractKey(user.avatarUrl);
      await this.storage.deleteFile(key).catch((err) =>
        this.logger.warn(`Failed to delete avatar from storage: ${err.message}`),
      );
    }

    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
  }

  // ─── Addresses ─────────────────────────────────────────────────────────────

  async getAddresses(userId: string): Promise<AddressResponseDto[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return addresses.map(AddressResponseDto.fromPrisma);
  }

  async createAddress(userId: string, dto: CreateAddressDto): Promise<AddressResponseDto> {
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
      throw new BadRequestException({
        code: 'ERR_ADDRESS_LIMIT',
        message: `Maximum of ${MAX_ADDRESSES} addresses allowed`,
      });
    }

    const isFirst = count === 0;
    const shouldBeDefault = dto.isDefault ?? isFirst;

    const address = await this.prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId,
          fullName: dto.fullName,
          addressLine1: dto.line1,
          addressLine2: dto.line2 ?? null,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          country: dto.country,
          phone: dto.phone ?? '',
          isDefault: shouldBeDefault,
        },
      });
    });

    return AddressResponseDto.fromPrisma(address);
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto): Promise<AddressResponseDto> {
    await this.requireOwnAddress(userId, addressId);

    const address = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      return tx.address.update({
        where: { id: addressId },
        data: {
          ...(dto.fullName !== undefined && { fullName: dto.fullName }),
          ...(dto.line1 !== undefined && { addressLine1: dto.line1 }),
          ...(dto.line2 !== undefined && { addressLine2: dto.line2 }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.state !== undefined && { state: dto.state }),
          ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
          ...(dto.country !== undefined && { country: dto.country }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        },
      });
    });

    return AddressResponseDto.fromPrisma(address);
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    await this.requireOwnAddress(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<AddressResponseDto> {
    await this.requireOwnAddress(userId, addressId);

    const address = await this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
    });

    return AddressResponseDto.fromPrisma(address);
  }

  // ─── Wishlist ──────────────────────────────────────────────────────────────

  async getWishlist(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<WishlistItemResponseDto>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.wishlistItem.findMany({
        where: { userId },
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
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.wishlistItem.count({ where: { userId } }),
    ]);

    const data = items.map((item): WishlistItemResponseDto => ({
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      productSlug: item.product.slug,
      productImageUrl: item.product.images[0]?.url ?? null,
      productBasePrice: Number(item.product.basePrice),
      addedAt: item.createdAt,
    }));

    return paginatedResponse<WishlistItemResponseDto>(data, pagination.page ?? 1, pagination.limit ?? 24, total);
  }

  async addToWishlist(userId: string, productId: string): Promise<{ id: string }> {
    await this.requireProductExists(productId);

    const existing = await this.prisma.wishlistItem.findFirst({ where: { userId, productId } });
    if (existing) {
      throw new ConflictException({ code: 'ERR_ALREADY_IN_WISHLIST', message: 'Product is already in your wishlist' });
    }

    const item = await this.prisma.wishlistItem.create({ data: { userId, productId } });
    return { id: item.id };
  }

  async removeFromWishlist(userId: string, productId: string): Promise<void> {
    const item = await this.prisma.wishlistItem.findFirst({ where: { userId, productId } });
    if (!item) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not in wishlist' });
    }
    await this.prisma.wishlistItem.delete({ where: { id: item.id } });
  }

  async isInWishlist(userId: string, productId: string): Promise<{ inWishlist: boolean }> {
    const item = await this.prisma.wishlistItem.findFirst({ where: { userId, productId } });
    return { inWishlist: !!item };
  }

  // ─── Wishlist Sharing ──────────────────────────────────────────────────────

  async getWishlistShareStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { wishlistShareToken: true, wishlistIsPublic: true, wishlistName: true },
    });
    if (!user) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'User not found' });
    return {
      token:    user.wishlistShareToken,
      isPublic: user.wishlistIsPublic,
      name:     user.wishlistName,
    };
  }

  async shareWishlist(userId: string) {
    // Reuse existing token if already shared; generate new one otherwise
    const existing = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { wishlistShareToken: true },
    });
    const token = existing?.wishlistShareToken ?? randomBytes(16).toString('hex');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data:  { wishlistShareToken: token, wishlistIsPublic: true },
      select: { wishlistShareToken: true, wishlistIsPublic: true, wishlistName: true },
    });
    return { token: user.wishlistShareToken!, isPublic: user.wishlistIsPublic, name: user.wishlistName };
  }

  async updateWishlistShare(userId: string, dto: UpdateWishlistShareDto) {
    const current = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { wishlistShareToken: true },
    });
    if (!current?.wishlistShareToken) {
      throw new BadRequestException({ code: 'ERR_WISHLIST_NOT_SHARED', message: 'Wishlist is not shared yet' });
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { wishlistName: dto.name ?? null }),
        ...(dto.isPublic !== undefined && { wishlistIsPublic: dto.isPublic }),
      },
      select: { wishlistShareToken: true, wishlistIsPublic: true, wishlistName: true },
    });
    return { token: user.wishlistShareToken!, isPublic: user.wishlistIsPublic, name: user.wishlistName };
  }

  async revokeWishlistShare(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data:  { wishlistShareToken: null, wishlistIsPublic: false, wishlistName: null },
    });
  }

  async getPublicWishlist(token: string): Promise<{ wishlistName: string | null; ownerName: string | null; items: WishlistItemResponseDto[] }> {
    const user = await this.prisma.user.findUnique({
      where:  { wishlistShareToken: token },
      select: { id: true, wishlistIsPublic: true, wishlistName: true, firstName: true },
    });

    // 404 for non-public or missing — prevent token enumeration
    if (!user || !user.wishlistIsPublic) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Wishlist not found' });
    }

    const items = await this.prisma.wishlistItem.findMany({
      where:   { userId: user.id },
      include: {
        product: {
          select: {
            id:        true,
            name:      true,
            slug:      true,
            basePrice: true,
            isActive:  true,
            images:    { where: { isPrimary: true }, select: { url: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeItems = items.filter((item) => item.product.isActive);

    return {
      wishlistName: user.wishlistName,
      ownerName:    user.firstName,
      items: activeItems.map((item): WishlistItemResponseDto => ({
        id:               item.id,
        productId:        item.productId,
        productName:      item.product.name,
        productSlug:      item.product.slug,
        productImageUrl:  item.product.images[0]?.url ?? null,
        productBasePrice: Number(item.product.basePrice),
        addedAt:          item.createdAt,
      })),
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async requireOwnAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.userId !== userId) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Address not found' });
    }
  }

  private async requireProductExists(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Product not found' });
    }
  }
}
