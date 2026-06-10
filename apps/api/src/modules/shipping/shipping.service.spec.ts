import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ShippingService } from './shipping.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockShippingMethod = {
  id: 'method-001',
  zoneId: 'zone-001',
  name: 'Standard Shipping',
  carrier: 'USPS',
  price: 5.99,
  freeShippingOver: null,
  minDays: 3,
  maxDays: 7,
  isActive: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

const mockShippingZone = {
  id: 'zone-001',
  name: 'Domestic US',
  countries: ['US'],
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  methods: [mockShippingMethod],
};

describe('ShippingService', () => {
  let service: ShippingService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ShippingService,
        { provide: PrismaService, useValue: mockDeep<PrismaService>() },
      ],
    }).compile();

    service = module.get(ShippingService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── calculateShipping ──────────────────────────────────────────────────────

  describe('calculateShipping', () => {
    it('returns correct cost, minDays, maxDays, and name for a standard method', async () => {
      prisma.shippingMethod.findUnique.mockResolvedValue(mockShippingMethod as any);

      const result = await service.calculateShipping('method-001', 30.00);

      expect(result).toEqual({
        cost: 5.99,
        minDays: 3,
        maxDays: 7,
        name: 'Standard Shipping',
      });
    });

    it('returns cost of 0 when order subtotal meets free shipping threshold', async () => {
      const methodWithFreeShipping = {
        ...mockShippingMethod,
        freeShippingOver: 50.00,
      };
      prisma.shippingMethod.findUnique.mockResolvedValue(methodWithFreeShipping as any);

      const result = await service.calculateShipping('method-001', 75.00);

      expect(result.cost).toBe(0);
    });

    it('charges full price when order subtotal is below free shipping threshold', async () => {
      const methodWithFreeShipping = {
        ...mockShippingMethod,
        freeShippingOver: 50.00,
      };
      prisma.shippingMethod.findUnique.mockResolvedValue(methodWithFreeShipping as any);

      const result = await service.calculateShipping('method-001', 30.00);

      expect(result.cost).toBe(5.99);
    });

    it('throws NotFoundException when shipping method is not found', async () => {
      prisma.shippingMethod.findUnique.mockResolvedValue(null);

      await expect(service.calculateShipping('nonexistent', 30.00)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_NOT_FOUND' }),
        }),
      );
    });

    it('throws NotFoundException when shipping method exists but is inactive', async () => {
      prisma.shippingMethod.findUnique.mockResolvedValue({
        ...mockShippingMethod,
        isActive: false,
      } as any);

      await expect(service.calculateShipping('method-001', 30.00)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getMethodsByCountry ────────────────────────────────────────────────────

  describe('getMethodsByCountry', () => {
    it('returns active shipping methods for a given country', async () => {
      prisma.shippingZone.findMany.mockResolvedValue([mockShippingZone] as any);

      const result = await service.getMethodsByCountry('US');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        methodId: 'method-001',
        name: 'Standard Shipping',
        carrier: 'USPS',
        price: 5.99,
        minDays: 3,
        maxDays: 7,
        isFree: false,
      });
    });

    it('returns empty array when no zones cover the country', async () => {
      prisma.shippingZone.findMany.mockResolvedValue([]);

      const result = await service.getMethodsByCountry('XX');

      expect(result).toEqual([]);
    });
  });

  // ── getZones ───────────────────────────────────────────────────────────────

  describe('getZones', () => {
    it('returns all zones with their methods', async () => {
      prisma.shippingZone.findMany.mockResolvedValue([mockShippingZone] as any);

      const result = await service.getZones();

      expect(result).toHaveLength(1);
      expect(result[0].methods).toHaveLength(1);
      expect(prisma.shippingZone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({ methods: expect.anything() }),
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  // ── createZone ─────────────────────────────────────────────────────────────

  describe('createZone', () => {
    it('creates and returns a new shipping zone', async () => {
      prisma.shippingZone.create.mockResolvedValue({
        ...mockShippingZone,
        methods: [],
      } as any);

      const result = await service.createZone({ name: 'Domestic US', countries: ['US'] });

      expect(prisma.shippingZone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'Domestic US', countries: ['US'] },
        }),
      );
      expect(result.name).toBe('Domestic US');
    });
  });

  // ── getZoneById ────────────────────────────────────────────────────────────

  describe('getZoneById', () => {
    it('returns the zone when it exists', async () => {
      prisma.shippingZone.findUnique.mockResolvedValue(mockShippingZone as any);

      const result = await service.getZoneById('zone-001');

      expect(result.id).toBe('zone-001');
    });

    it('throws NotFoundException when zone does not exist', async () => {
      prisma.shippingZone.findUnique.mockResolvedValue(null);

      await expect(service.getZoneById('bad-zone')).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'ERR_NOT_FOUND' }),
        }),
      );
    });
  });

  // ── buildTrackingUrl ───────────────────────────────────────────────────────

  describe('buildTrackingUrl', () => {
    it('builds USPS tracking URL', () => {
      const url = service.buildTrackingUrl('USPS', '9400111899223387623910');
      expect(url).toContain('tools.usps.com');
      expect(url).toContain('9400111899223387623910');
    });

    it('builds FedEx tracking URL', () => {
      const url = service.buildTrackingUrl('FEDEX', '748927639876');
      expect(url).toContain('fedex.com');
    });

    it('builds UPS tracking URL', () => {
      const url = service.buildTrackingUrl('UPS', '1Z999AA10123456784');
      expect(url).toContain('ups.com');
    });

    it('builds DHL tracking URL', () => {
      const url = service.buildTrackingUrl('DHL', '1234567890');
      expect(url).toContain('dhl.com');
    });

    it('falls back to Google search for unknown carriers', () => {
      const url = service.buildTrackingUrl('LASERAWAY', 'TRK123');
      expect(url).toContain('google.com/search');
    });
  });
});
