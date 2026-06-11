import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DesignLicensingService {
  private readonly logger = new Logger(DesignLicensingService.name);
  private readonly stripe: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' as const });
  }

  // ── Public: browse marketplace ────────────────────────────────────────────

  async listDesigns(query: {
    page?: number; limit?: number; licenseType?: string; search?: string;
  }) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 24;

    const where: any = { isActive: true };
    if (query.licenseType) where.licenseType = query.licenseType;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.designAsset.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: { store: { select: { name: true, slug: true } } },
      }),
      this.prisma.designAsset.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getDesign(id: string) {
    return this.prisma.designAsset.findUnique({
      where:   { id },
      include: { store: { select: { name: true, slug: true, logoUrl: true } } },
    });
  }

  // ── Seller: list design for licensing ─────────────────────────────────────

  async listDesignForLicense(storeId: string, dto: {
    title: string; description: string; previewImageUrl: string;
    fullResImageUrl: string; licenseType: 'EXCLUSIVE' | 'NON_EXCLUSIVE';
    listingPrice: number; royaltyRate?: number;
    licenseModel: 'ONE_TIME' | 'ROYALTY_PER_SALE' | 'BOTH'; tags: string[];
  }) {
    return this.prisma.designAsset.create({
      data: { ...dto, storeId },
    });
  }

  // ── Buyer: purchase license ────────────────────────────────────────────────

  async purchaseLicense(buyerStoreId: string, assetId: string): Promise<{ clientSecret: string }> {
    const asset = await this.prisma.designAsset.findUnique({
      where: { id: assetId },
      include: { store: true },
    });
    if (!asset || !asset.isActive) throw new NotFoundException('Design not found');
    if (asset.storeId === buyerStoreId) throw new BadRequestException('Cannot license your own design');

    // Check exclusive already sold
    if (asset.licenseType === 'EXCLUSIVE') {
      const existingLicense = await this.prisma.designLicense.findFirst({
        where: { assetId, status: 'ACTIVE' },
      });
      if (existingLicense) throw new BadRequestException('Exclusive license already sold');
    }

    const platformFeeAmount = Math.round(Number(asset.listingPrice) * 0.15 * 100) / 100;
    const licensorEarnings  = Number(asset.listingPrice) - platformFeeAmount;

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount:   Math.round(Number(asset.listingPrice) * 100),
      currency: 'usd',
      metadata: { assetId, buyerStoreId, licensorStoreId: asset.storeId, type: 'design_license' },
    });

    // Create pending license record
    await this.prisma.designLicense.create({
      data: {
        assetId,
        licenseeStoreId:      buyerStoreId,
        licensorStoreId:      asset.storeId,
        licenseType:          asset.licenseType,
        purchasePrice:        asset.listingPrice,
        royaltyRate:          asset.royaltyRate,
        platformFee:          platformFeeAmount,
        licensorEarnings,
        status:               'ACTIVE',
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    // If exclusive — deactivate listing
    if (asset.licenseType === 'EXCLUSIVE') {
      await this.prisma.designAsset.update({
        where: { id: assetId },
        data:  { isActive: false },
      });
    }

    await this.prisma.designAsset.update({
      where: { id: assetId },
      data:  { licenseCount: { increment: 1 } },
    });

    return { clientSecret: paymentIntent.client_secret! };
  }

  // ── Royalty tracking ───────────────────────────────────────────────────────

  async processRoyaltiesForOrder(orderId: string): Promise<void> {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { product: { select: { designLicenseId: true } } },
    });

    for (const item of items) {
      if (!item.product?.designLicenseId) continue;
      const license = await this.prisma.designLicense.findUnique({
        where: { id: item.product!.designLicenseId! },
      });
      if (!license || !license.royaltyRate) continue;

      const royaltyAmount = Math.round(
        Number(item.unitPrice) * item.quantity * Number(license.royaltyRate) * 100,
      ) / 100;

      await this.prisma.royaltyEarning.create({
        data: {
          licenseId:      license.id,
          triggerOrderId: orderId,
          amount:         royaltyAmount,
          status:         'PENDING',
        },
      });
    }
  }

  // ── Seller: view licenses ─────────────────────────────────────────────────

  async getMyLicenses(storeId: string, role: 'licensor' | 'licensee') {
    if (role === 'licensor') {
      return this.prisma.designLicense.findMany({
        where:   { licensorStoreId: storeId },
        include: {
          asset:          { select: { title: true, previewImageUrl: true } },
          licenseeStore:  { select: { name: true } },
        },
        orderBy: { purchasedAt: 'desc' },
      });
    }
    return this.prisma.designLicense.findMany({
      where:   { licenseeStoreId: storeId },
      include: {
        asset:        { select: { title: true, previewImageUrl: true } },
        licensorStore: { select: { name: true } },
      },
      orderBy: { purchasedAt: 'desc' },
    });
  }
}
