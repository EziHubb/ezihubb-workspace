import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProcessingProfileDto,
  UpdateProcessingProfileDto,
  ProcessingScheduleDto,
  DeliveryUpgradesDto,
} from './dto/processing-profile.dto';
import { ShippingProfileDto, ShippingProfileMethodDto } from './dto/shipping-profile.dto';
import { ShippingProfile, ShippingProfileMethod as ShippingProfileMethodModel } from '@prisma/client';
import { carrierServiceLabel } from '@ezihubb/constants';

export interface SellerShippingCost {
  perStore:      Map<string, number>;
  methodNames:   Map<string, string>;
  /** Per-store delivery-time SLA, for display (e.g. cart/checkout estimate). */
  deliveryDays:  Map<string, { minDays: number; maxDays: number }>;
}

@Injectable()
export class ShippingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves per-store checkout shipping cost from each product's own
   * seller-assigned ShippingProfile (Etsy-parity Delivery profiles), for a
   * given destination country. Returns null if ANY physical item lacks a
   * resolvable profile (no profile assigned, a deleted/dangling reference,
   * or the profile has no row covering this destination) — callers must
   * treat that as "this order can't be priced yet" (see OrdersService.checkout()
   * and CartService.estimateShipping()). Every physical listing is required
   * to carry both a processing profile and a delivery profile before it can
   * be published (see ProductsService.update()), so this should be rare in
   * practice — legacy listings that predate that requirement are the only
   * way to hit it.
   */
  async resolveSellerShippingCost(
    items: { storeId: string | null; shippingProfileId: string | null; quantity: number }[],
    destinationCountry: string,
  ): Promise<SellerShippingCost | null> {
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

    const perStore     = new Map<string, number>();
    const methodNames  = new Map<string, string>();
    const deliveryDays = new Map<string, { minDays: number; maxDays: number }>();
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
        deliveryDays.set(storeId, { minDays: method.minDays, maxDays: method.maxDays });
      } else {
        // Multiple profiles within the same store — widen the range to cover both.
        const prev = deliveryDays.get(storeId)!;
        deliveryDays.set(storeId, {
          minDays: Math.min(prev.minDays, method.minDays),
          maxDays: Math.max(prev.maxDays, method.maxDays),
        });
      }
    }

    return { perStore, methodNames, deliveryDays };
  }

  // ─── Processing & shipping profiles ─────────────────────────────────────────

  /**
   * Which of these listings ship free to EVERY destination their profile serves.
   *
   * The grid has no delivery address — a visitor browsing has not told anyone
   * where they are — so a badge there cannot say "free to you". It can only
   * say "free, wherever you are", and that is true just when every method on
   * the profile costs nothing. A profile that is free domestically and charged
   * abroad is not free shipping to the person reading it from abroad, and
   * saying so is the same false promise in a smaller form.
   *
   * The cost test mirrors resolveSellerShippingCost above, which is what
   * checkout actually charges: FREE, or a FIXED method priced at zero with no
   * per-extra-item surcharge. A badge derived from a different rule than the
   * till uses is a badge that will eventually contradict it.
   */
  async freeShippingListingIds(
    listings: { id: string; shippingProfileId: string | null }[],
  ): Promise<Set<string>> {
    const free = new Set<string>();
    const profileIds = [...new Set(listings.map((l) => l.shippingProfileId).filter((x): x is string => !!x))];
    if (profileIds.length === 0) return free;

    const profiles = await this.prisma.shippingProfile.findMany({
      where:   { id: { in: profileIds } },
      select:  { id: true, methods: { select: { chargeType: true, price: true, extraItemPrice: true } } },
    });

    const freeProfiles = new Set(
      profiles
        .filter((profile) =>
          // No methods at all means the profile cannot price anything, which
          // is unresolvable rather than free — checkout hard-errors on it.
          profile.methods.length > 0 &&
          profile.methods.every((m) =>
            m.chargeType === 'FREE' ||
            (Number(m.price ?? 0) === 0 && Number(m.extraItemPrice ?? m.price ?? 0) === 0),
          ),
        )
        .map((profile) => profile.id),
    );

    for (const l of listings) {
      if (l.shippingProfileId && freeProfiles.has(l.shippingProfileId)) free.add(l.id);
    }
    return free;
  }

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
