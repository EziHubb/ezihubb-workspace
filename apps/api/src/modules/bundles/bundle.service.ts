import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertBundleSettingsDto {
  isEnabled: boolean;
  minBundleValue: number;
  tier2Discount: number;
  tier3Discount: number;
  tier4PlusDiscount: number;
  excludedProductIds?: string[];
}

@Injectable()
export class BundleService {
  constructor(private readonly prisma: PrismaService) {}

  async getStoreSettings(storeId: string) {
    return this.prisma.storeBundleSettings.findUnique({ where: { storeId } });
  }

  async upsertStoreSettings(storeId: string, dto: UpsertBundleSettingsDto) {
    return this.prisma.storeBundleSettings.upsert({
      where: { storeId },
      create: { storeId, ...dto },
      update: dto,
    });
  }

  /**
   * Given a list of cart items for a store, compute the bundle discount.
   * Tiers are based on the store's configured discount percentages:
   *   tier2: 2–3 items above minBundleValue → tier2Discount %
   *   tier3: 4+ items → tier3Discount %
   *   tier4+: applied when itemCount >= 5 → tier4PlusDiscount %
   */
  async calculateBundleDiscount(
    storeId: string,
    itemCount: number,
    subtotal: number,
  ): Promise<{ discountAmt: number; tier: number }> {
    const settings = await this.prisma.storeBundleSettings.findUnique({ where: { storeId } });
    if (!settings || !settings.isEnabled) return { discountAmt: 0, tier: 0 };

    let tier = 0;
    let pct = 0;

    if (itemCount >= 5) {
      tier = 4;
      pct = settings.tier4PlusDiscount;
    } else if (itemCount >= 4) {
      tier = 3;
      pct = settings.tier3Discount;
    } else if (itemCount >= 2) {
      tier = 2;
      pct = settings.tier2Discount;
    }

    const discountAmt = tier > 0 ? Math.round(subtotal * pct) / 100 : 0;
    return { discountAmt, tier };
  }

  /** Suggest upsell items from the same store to hit the next bundle tier. */
  async getUpsellSuggestions(storeId: string, currentItemCount: number) {
    const settings = await this.prisma.storeBundleSettings.findUnique({ where: { storeId } });
    if (!settings || !settings.isEnabled) return { suggestions: [], nextTierAt: null };

    let nextTierAt: number | null = null;
    if (currentItemCount < 2) nextTierAt = 2;
    else if (currentItemCount < 4) nextTierAt = 4;
    else if (currentItemCount < 5) nextTierAt = 5;

    if (!nextTierAt) return { suggestions: [], nextTierAt: null };

    const products = await this.prisma.product.findMany({
      where: { storeId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        images: { take: 1 },
      },
    });

    return {
      suggestions: products,
      nextTierAt,
      itemsNeeded: nextTierAt - currentItemCount,
    };
  }
}
