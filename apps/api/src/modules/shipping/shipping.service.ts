import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import {
  CreateProcessingProfileDto,
  UpdateProcessingProfileDto,
  ProcessingScheduleDto,
  DeliveryUpgradesDto,
} from './dto/processing-profile.dto';
import { ShippingProfileDto, ShippingProfileMethodDto } from './dto/shipping-profile.dto';
import { ShippingZone, ShippingMethod, ShippingProfile, ShippingProfileMethod as ShippingProfileMethodModel } from '@prisma/client';
import { carrierServiceLabel } from '@ezihubb/constants';

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

  /**
   * Resolves per-store checkout shipping cost from each product's own
   * seller-assigned ShippingProfile (Etsy-parity Delivery profiles), for a
   * given destination country. Returns null if ANY physical item lacks a
   * resolvable profile (no profile assigned, a deleted/dangling reference,
   * or the profile has no row covering this destination) — callers fall
   * back to the legacy ShippingZone/shippingMethodId flat-rate path for the
   * WHOLE order in that case, deliberately avoiding a partial blend of two
   * different pricing models within one checkout. See OrdersService.checkout().
   */
  async resolveSellerShippingCost(
    items: { storeId: string | null; shippingProfileId: string | null; quantity: number }[],
    destinationCountry: string,
  ): Promise<{ perStore: Map<string, number>; methodNames: Map<string, string> } | null> {
    if (items.some((i) => !i.storeId || !i.shippingProfileId)) return null;

    const profileIds = [...new Set(items.map((i) => i.shippingProfileId as string))];
    const profiles = await this.prisma.shippingProfile.findMany({
      where:   { id: { in: profileIds } },
      include: { methods: true },
    });
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    type Group = { storeId: string; profile: ShippingProfile & { methods: ShippingProfileMethodModel[] }; quantity: number };
    const groups = new Map<string, Group>();
    for (const item of items) {
      const profile = profileMap.get(item.shippingProfileId as string);
      if (!profile) return null;
      const key = `${item.storeId}:${profile.id}`;
      const existing = groups.get(key);
      if (existing) existing.quantity += item.quantity;
      else groups.set(key, { storeId: item.storeId as string, profile, quantity: item.quantity });
    }

    const perStore    = new Map<string, number>();
    const methodNames = new Map<string, string>();
    const dest = destinationCountry.toUpperCase();

    for (const { storeId, profile, quantity } of groups.values()) {
      const method =
        profile.methods.find((m) => m.destinationType === dest) ??
        (dest === profile.originCountry
          ? profile.methods.find((m) => m.destinationType === 'domestic')
          : profile.methods.find((m) => m.destinationType === 'everywhere_else'));
      if (!method) return null;

      const cost = method.chargeType === 'FREE'
        ? 0
        : Number(method.price ?? 0) + Number(method.extraItemPrice ?? method.price ?? 0) * Math.max(0, quantity - 1);

      perStore.set(storeId, (perStore.get(storeId) ?? 0) + cost);
      if (!methodNames.has(storeId)) {
        methodNames.set(
          storeId,
          method.carrierService === 'OTHER' ? (method.carrierName ?? 'Standard Shipping') : carrierServiceLabel(method.carrierService),
        );
      }
    }

    return { perStore, methodNames };
  }

  // ─── Processing & shipping profiles ─────────────────────────────────────────

  async getProcessingProfiles() {
    return this.prisma.processingProfile.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getProcessingProfilesForStore(storeId: string) {
    return this.prisma.processingProfile.findMany({
      where:   { OR: [{ storeId }, { storeId: null, isDefault: true }] },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getShippingProfiles() {
    const profiles = await this.prisma.shippingProfile.findMany({
      include: { methods: true, _count: { select: { products: true } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return profiles.map(this.withLiveActiveListings);
  }

  async getShippingProfilesForStore(storeId: string) {
    const profiles = await this.prisma.shippingProfile.findMany({
      where:   { OR: [{ storeId }, { storeId: null, isDefault: true }] },
      include: { methods: true, _count: { select: { products: true } } },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return profiles.map(this.withLiveActiveListings);
  }

  /** activeListings on the row itself is a denormalised column nothing keeps
   *  in sync — always trust a live product count instead. */
  private withLiveActiveListings<T extends { _count: { products: number } }>(
    profile: T,
  ): Omit<T, '_count'> & { activeListings: number } {
    const { _count, ...rest } = profile;
    return { ...rest, activeListings: _count.products };
  }

  // ── Processing profiles — seller CRUD ────────────────────────────────────────

  async createProcessingProfile(storeId: string, dto: CreateProcessingProfileDto) {
    return this.prisma.processingProfile.create({ data: { ...dto, storeId } });
  }

  async updateProcessingProfile(storeId: string, id: string, dto: UpdateProcessingProfileDto) {
    await this.assertOwnsProcessingProfile(storeId, id);
    return this.prisma.processingProfile.update({ where: { id }, data: dto });
  }

  async deleteProcessingProfile(storeId: string, id: string) {
    await this.assertOwnsProcessingProfile(storeId, id);
    const inUse = await this.prisma.product.count({ where: { processingProfileId: id } });
    if (inUse > 0) {
      throw new ConflictException({
        code:    'ERR_PROFILE_IN_USE',
        message: `This profile is applied to ${inUse} active listing${inUse === 1 ? '' : 's'} — reassign them to a different processing profile before deleting.`,
      });
    }
    await this.prisma.processingProfile.delete({ where: { id } });
  }

  private async assertOwnsProcessingProfile(storeId: string, id: string): Promise<void> {
    const profile = await this.prisma.processingProfile.findUnique({ where: { id }, select: { storeId: true } });
    if (!profile) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Processing profile not found' });
    if (profile.storeId !== storeId) throw new ForbiddenException('You do not have access to this processing profile');
  }

  // ── Order processing schedule (Store-level) ──────────────────────────────────

  async getProcessingSchedule(storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where:  { id: storeId },
      select: { processesOnSaturday: true, processesOnSunday: true },
    });
    return store;
  }

  async updateProcessingSchedule(storeId: string, dto: ProcessingScheduleDto) {
    return this.prisma.store.update({
      where:  { id: storeId },
      data:   dto,
      select: { processesOnSaturday: true, processesOnSunday: true },
    });
  }

  // ── Delivery upgrades — shop-level switch ────────────────────────────────────

  async getDeliveryUpgradesEnabled(storeId: string) {
    const store = await this.prisma.store.findUniqueOrThrow({
      where:  { id: storeId },
      select: { deliveryUpgradesEnabled: true },
    });
    return { enabled: store.deliveryUpgradesEnabled };
  }

  async updateDeliveryUpgradesEnabled(storeId: string, dto: DeliveryUpgradesDto) {
    const store = await this.prisma.store.update({
      where:  { id: storeId },
      data:   { deliveryUpgradesEnabled: dto.enabled },
      select: { deliveryUpgradesEnabled: true },
    });
    return { enabled: store.deliveryUpgradesEnabled };
  }

  // ── Delivery (shipping) profiles — seller CRUD ───────────────────────────────
  // Etsy's "Delivery profiles" — a small, always-fully-submitted list of
  // destination rows, so updates replace the whole methods list in one
  // transaction rather than diffing (same approach as ManageVariationsModal's
  // applyVariations for variant price grids).

  async createShippingProfile(storeId: string, dto: ShippingProfileDto) {
    this.validateShippingProfileMethods(dto.methods);
    return this.prisma.shippingProfile.create({
      data: {
        name:             dto.name,
        originCountry:    dto.originCountry.toUpperCase(),
        originPostalCode: dto.originPostalCode,
        storeId,
        methods: { create: dto.methods.map((m) => this.toMethodData(m)) },
      },
      include: { methods: true },
    });
  }

  async updateShippingProfile(storeId: string, id: string, dto: ShippingProfileDto) {
    await this.assertOwnsShippingProfile(storeId, id);
    this.validateShippingProfileMethods(dto.methods);
    return this.prisma.$transaction(async (tx) => {
      await tx.shippingProfileMethod.deleteMany({ where: { profileId: id } });
      return tx.shippingProfile.update({
        where: { id },
        data: {
          name:             dto.name,
          originCountry:    dto.originCountry.toUpperCase(),
          originPostalCode: dto.originPostalCode,
          methods: { create: dto.methods.map((m) => this.toMethodData(m)) },
        },
        include: { methods: true },
      });
    });
  }

  async deleteShippingProfile(storeId: string, id: string) {
    await this.assertOwnsShippingProfile(storeId, id);
    const inUse = await this.prisma.product.count({ where: { shippingProfileId: id } });
    if (inUse > 0) {
      throw new ConflictException({
        code:    'ERR_PROFILE_IN_USE',
        message: `This profile is applied to ${inUse} active listing${inUse === 1 ? '' : 's'} — reassign them to a different delivery profile before deleting.`,
      });
    }
    await this.prisma.shippingProfile.delete({ where: { id } });
  }

  private validateShippingProfileMethods(methods: ShippingProfileMethodDto[]): void {
    for (const m of methods) {
      if (m.chargeType === 'FIXED' && (m.price === undefined || m.price === null)) {
        throw new BadRequestException(`A price is required for the "${m.destinationType}" row when charging a fixed price`);
      }
    }
  }

  private toMethodData(m: ShippingProfileMethodDto) {
    const isFree = m.chargeType === 'FREE';
    return {
      destinationType: m.destinationType,
      carrierService:  m.carrierService,
      carrierName:     m.carrierService === 'OTHER' ? (m.carrierName ?? null) : null,
      chargeType:      m.chargeType,
      minDays:         m.minDays,
      maxDays:         m.maxDays,
      price:           isFree ? null : m.price,
      extraItemPrice:  isFree ? null : (m.extraItemPrice ?? null),
    };
  }

  private async assertOwnsShippingProfile(storeId: string, id: string): Promise<void> {
    const profile = await this.prisma.shippingProfile.findUnique({ where: { id }, select: { storeId: true } });
    if (!profile) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Delivery profile not found' });
    if (profile.storeId !== storeId) throw new ForbiddenException('You do not have access to this delivery profile');
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

  async getShippingSettings() {
    const s = await this.prisma.platformSettings.upsert({
      where:  { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
      select: {
        freeShippingEnabled:   true,
        freeShippingMinAmount: true,
        freeShippingZoneIds:   true,
        defaultProcessingDays: true,
        showEstimatedDelivery: true,
        showCarrierInCheckout: true,
      },
    });
    return {
      ...s,
      freeShippingMinAmount: Number(s.freeShippingMinAmount),
    };
  }

  async updateShippingSettings(dto: {
    freeShippingEnabled?:   boolean;
    freeShippingMinAmount?: number;
    freeShippingZoneIds?:   string[];
    defaultProcessingDays?: number;
    showEstimatedDelivery?: boolean;
    showCarrierInCheckout?: boolean;
  }) {
    const s = await this.prisma.platformSettings.upsert({
      where:  { id: 'singleton' },
      update: dto,
      create: { id: 'singleton', ...dto },
      select: {
        freeShippingEnabled:   true,
        freeShippingMinAmount: true,
        freeShippingZoneIds:   true,
        defaultProcessingDays: true,
        showEstimatedDelivery: true,
        showCarrierInCheckout: true,
      },
    });
    return {
      ...s,
      freeShippingMinAmount: Number(s.freeShippingMinAmount),
    };
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
