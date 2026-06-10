import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { RedisService } from '../../common/services/redis.service';
import { UsersService } from './users.service';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

const mockStorage = {
  extractKey: jest.fn(),
  deleteFile: jest.fn(),
  generateKey: jest.fn(),
  uploadFile: jest.fn(),
  getPublicUrl: jest.fn(),
};

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  role: 'CUSTOMER',
  avatarUrl: null,
  isEmailVerified: true,
  phone: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  wishlistShareToken: null,
  wishlistIsPublic: false,
  wishlistName: null,
  ...overrides,
});

const makeAddress = (overrides: Record<string, unknown> = {}) => ({
  id: 'addr-1',
  userId: 'user-1',
  fullName: 'Alice Smith',
  addressLine1: '123 Main St',
  addressLine2: null,
  city: 'Springfield',
  state: 'IL',
  postalCode: '62701',
  country: 'US',
  phone: '555-0100',
  isDefault: false,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: mockStorage },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  // ─── getProfile ──────────────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns UserResponseDto when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser() as never);

      const result = await service.getProfile('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('alice@example.com');
      expect(result.firstName).toBe('Alice');
    });

    it('throws NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateProfile ───────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('saves patch fields and returns updated dto', async () => {
      const updated = makeUser({ firstName: 'Bob', lastName: 'Jones' });
      prisma.user.update.mockResolvedValue(updated as never);

      const result = await service.updateProfile('user-1', { firstName: 'Bob', lastName: 'Jones' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { firstName: 'Bob', lastName: 'Jones' },
      });
      expect(result.firstName).toBe('Bob');
      expect(result.lastName).toBe('Jones');
    });

    it('omits undefined fields from the update data', async () => {
      const updated = makeUser({ firstName: 'Carol' });
      prisma.user.update.mockResolvedValue(updated as never);

      await service.updateProfile('user-1', { firstName: 'Carol' });

      const callData = prisma.user.update.mock.calls[0][0].data as Record<string, unknown>;
      expect(callData).not.toHaveProperty('lastName');
    });
  });

  // ─── createAddress (addAddress) ───────────────────────────────────────────────

  describe('createAddress', () => {
    const dto = {
      fullName: 'Alice Smith',
      line1: '123 Main St',
      line2: undefined,
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'US',
      phone: '555-0100',
      isDefault: undefined,
    };

    it('sets isDefault=true when it is the first address', async () => {
      prisma.address.count.mockResolvedValue(0);
      const created = makeAddress({ isDefault: true });
      // $transaction executes the callback
      prisma.$transaction.mockImplementation(async (fn: unknown) => {
        if (typeof fn === 'function') {
          const tx = {
            address: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
              create: jest.fn().mockResolvedValue(created),
            },
          };
          return fn(tx);
        }
        return fn;
      });

      const result = await service.createAddress('user-1', dto);

      expect(result.isDefault).toBe(true);
    });

    it('does not force isDefault when it is not the first address and dto.isDefault is falsy', async () => {
      prisma.address.count.mockResolvedValue(3);
      const created = makeAddress({ isDefault: false });
      prisma.$transaction.mockImplementation(async (fn: unknown) => {
        if (typeof fn === 'function') {
          const tx = {
            address: {
              updateMany: jest.fn().mockResolvedValue({ count: 0 }),
              create: jest.fn().mockResolvedValue(created),
            },
          };
          return fn(tx);
        }
        return fn;
      });

      const result = await service.createAddress('user-1', { ...dto, isDefault: false });

      expect(result.isDefault).toBe(false);
    });

    it('throws BadRequestException when address limit is reached', async () => {
      prisma.address.count.mockResolvedValue(10);

      await expect(service.createAddress('user-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── deleteAddress (removeAddress) ───────────────────────────────────────────

  describe('deleteAddress', () => {
    it('deletes address when it belongs to the user', async () => {
      prisma.address.findUnique.mockResolvedValue(makeAddress() as never);
      prisma.address.delete.mockResolvedValue(makeAddress() as never);

      await expect(service.deleteAddress('user-1', 'addr-1')).resolves.toBeUndefined();
      expect(prisma.address.delete).toHaveBeenCalledWith({ where: { id: 'addr-1' } });
    });

    it('throws NotFoundException when address does not belong to user', async () => {
      // Address belongs to a different user
      prisma.address.findUnique.mockResolvedValue(makeAddress({ userId: 'other-user' }) as never);

      await expect(service.deleteAddress('user-1', 'addr-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when address does not exist', async () => {
      prisma.address.findUnique.mockResolvedValue(null);

      await expect(service.deleteAddress('user-1', 'addr-999')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── toggleWishlist (addToWishlist / removeFromWishlist) ─────────────────────

  describe('addToWishlist', () => {
    it('creates wishlist item when product is not yet in wishlist', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' } as never);
      prisma.wishlistItem.findFirst.mockResolvedValue(null);
      prisma.wishlistItem.create.mockResolvedValue({ id: 'wl-1', userId: 'user-1', productId: 'prod-1' } as never);

      const result = await service.addToWishlist('user-1', 'prod-1');

      expect(result.id).toBe('wl-1');
      expect(prisma.wishlistItem.create).toHaveBeenCalled();
    });

    it('throws ConflictException when product is already in wishlist', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' } as never);
      prisma.wishlistItem.findFirst.mockResolvedValue({ id: 'wl-1' } as never);

      await expect(service.addToWishlist('user-1', 'prod-1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.addToWishlist('user-1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeFromWishlist', () => {
    it('deletes wishlist item when it exists', async () => {
      prisma.wishlistItem.findFirst.mockResolvedValue({ id: 'wl-1', userId: 'user-1', productId: 'prod-1' } as never);
      prisma.wishlistItem.delete.mockResolvedValue({} as never);

      await expect(service.removeFromWishlist('user-1', 'prod-1')).resolves.toBeUndefined();
      expect(prisma.wishlistItem.delete).toHaveBeenCalledWith({ where: { id: 'wl-1' } });
    });

    it('throws NotFoundException when product is not in wishlist', async () => {
      prisma.wishlistItem.findFirst.mockResolvedValue(null);

      await expect(service.removeFromWishlist('user-1', 'prod-1')).rejects.toThrow(NotFoundException);
    });
  });
});
