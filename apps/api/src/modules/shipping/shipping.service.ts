import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShippingEstimateDto } from '../cart/dto/cart-response.dto';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';
import {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
} from './dto/create-shipping-zone.dto';
import {
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
} from './dto/create-shipping-method.dto';
import { ShippingZone, ShippingMethod } from '@prisma/client';

export type ZoneWithMethods = ShippingZone & { methods: ShippingMethod[] };

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns all active shipping methods available for a given country. */
  async getMethodsByCountry(
    countryCode: string,
  ): Promise<ShippingEstimateDto[]> {
    const zones = await this.prisma.shippingZone.findMany({
      where: { countries: { has: countryCode } },
      include: { methods: { where: { isActive: true } } },
    });

    if (!zones.length) return [];

    return zones.flatMap((zone) =>
      zone.methods.map((m) => ({
        methodId: m.id,
        name: m.name,
        carrier: m.carrier ?? null,
        price: Number(m.price),
        minDays: m.minDays,
        maxDays: m.maxDays,
        isFree: false,
      })),
    );
  }

  /** Calculates shipping cost for a specific method, considering free-shipping threshold. */
  async calculateShipping(
    methodId: string,
    orderSubtotalAfterDiscount: number,
  ): Promise<{ cost: number; minDays: number; maxDays: number; name: string }> {
    const method = await this.prisma.shippingMethod.findUnique({
      where: { id: methodId },
    });

    if (!method || !method.isActive) {
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Shipping method not found or inactive',
      });
    }

    const isFree =
      method.freeShippingOver !== null &&
      orderSubtotalAfterDiscount >= Number(method.freeShippingOver);

    return {
      cost: isFree ? 0 : Number(method.price),
      minDays: method.minDays,
      maxDays: method.maxDays,
      name: method.name,
    };
  }

  /** Returns all options for a country+total, with isFree applied. */
  async calculateShippingOptions(
    dto: CalculateShippingDto,
  ): Promise<ShippingEstimateDto[]> {
    const zones = await this.prisma.shippingZone.findMany({
      where: { countries: { has: dto.countryCode } },
      include: { methods: { where: { isActive: true } } },
    });

    if (!zones.length) return [];

    return zones.flatMap((zone) =>
      zone.methods.map((m) => {
        const isFree =
          m.freeShippingOver !== null &&
          dto.orderTotal >= Number(m.freeShippingOver);
        return {
          methodId: m.id,
          name: m.name,
          carrier: m.carrier ?? null,
          price: isFree ? 0 : Number(m.price),
          minDays: m.minDays,
          maxDays: m.maxDays,
          isFree,
        };
      }),
    );
  }

  // ─── Processing & shipping profiles ─────────────────────────────────────────

  async getProcessingProfiles() {
    return this.prisma.processingProfile.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getShippingProfiles() {
    return this.prisma.shippingProfile.findMany({
      include: { methods: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getShippingProfilesForStore(storeId: string) {
    return this.prisma.shippingProfile.findMany({
      where:   { OR: [{ storeId }, { storeId: null, isDefault: true }] },
      include: { methods: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  // ── Zone CRUD ────────────────────────────────────────────────────────────────

  async getZones(): Promise<ZoneWithMethods[]> {
    return this.prisma.shippingZone.findMany({
      include: { methods: { orderBy: { price: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async getZoneById(id: string): Promise<ZoneWithMethods> {
    const zone = await this.prisma.shippingZone.findUnique({
      where: { id },
      include: { methods: { orderBy: { price: 'asc' } } },
    });
    if (!zone)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Shipping zone not found',
      });
    return zone;
  }

  async createZone(dto: CreateShippingZoneDto): Promise<ZoneWithMethods> {
    return this.prisma.shippingZone.create({
      data: { name: dto.name, countries: dto.countries },
      include: { methods: true },
    });
  }

  async updateZone(
    id: string,
    dto: UpdateShippingZoneDto,
  ): Promise<ZoneWithMethods> {
    await this.getZoneById(id);
    return this.prisma.shippingZone.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.countries && { countries: dto.countries }),
      },
      include: { methods: true },
    });
  }

  async deleteZone(id: string): Promise<void> {
    await this.getZoneById(id);
    await this.prisma.shippingZone.delete({ where: { id } });
  }

  // ── Method CRUD ──────────────────────────────────────────────────────────────

  async getMethodsByZone(zoneId: string): Promise<ShippingMethod[]> {
    await this.getZoneById(zoneId);
    return this.prisma.shippingMethod.findMany({
      where: { zoneId },
      orderBy: { price: 'asc' },
    });
  }

  async createMethod(
    zoneId: string,
    dto: CreateShippingMethodDto,
  ): Promise<ShippingMethod> {
    await this.getZoneById(zoneId);
    return this.prisma.shippingMethod.create({
      data: {
        zoneId,
        name: dto.name,
        carrier: dto.carrier,
        price: dto.price,
        freeShippingOver: dto.freeShippingOver ?? null,
        minDays: dto.minDays,
        maxDays: dto.maxDays,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateMethod(
    id: string,
    dto: UpdateShippingMethodDto,
  ): Promise<ShippingMethod> {
    const existing = await this.prisma.shippingMethod.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Shipping method not found',
      });

    return this.prisma.shippingMethod.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.carrier !== undefined && { carrier: dto.carrier }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.freeShippingOver !== undefined && {
          freeShippingOver: dto.freeShippingOver,
        }),
        ...(dto.minDays !== undefined && { minDays: dto.minDays }),
        ...(dto.maxDays !== undefined && { maxDays: dto.maxDays }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async deleteMethod(id: string): Promise<void> {
    const existing = await this.prisma.shippingMethod.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException({
        code: 'ERR_NOT_FOUND',
        message: 'Shipping method not found',
      });
    await this.prisma.shippingMethod.delete({ where: { id } });
  }

  /** Returns the carrier-specific tracking URL for a given tracking number. */
  buildTrackingUrl(carrier: string, trackingNumber: string): string {
    const c = carrier.toUpperCase();
    if (c === 'USPS')
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
    if (c === 'FEDEX')
      return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
    if (c === 'UPS')
      return `https://www.ups.com/track?tracknum=${trackingNumber}`;
    if (c === 'DHL')
      return `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`;
    return `https://google.com/search?q=${encodeURIComponent(carrier)}+tracking+${trackingNumber}`;
  }
}
