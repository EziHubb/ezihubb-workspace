/** Keep this in sync with PlatformSettings.freeShippingThreshold's DB default. */
export const DEFAULT_PLATFORM_FREE_SHIPPING_THRESHOLD = 100;

/**
 * Converts Prisma Decimal/API values into the one threshold used by cart and
 * checkout. Invalid data falls back safely; zero deliberately disables the
 * platform-funded policy.
 */
export function resolveFreeShippingThreshold(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_PLATFORM_FREE_SHIPPING_THRESHOLD;
}

export function qualifiesForPlatformFreeShipping(
  merchandiseSubtotal: number,
  threshold: number,
): boolean {
  if (threshold <= 0) return false;

  // Compare integer cents so floating-point residue cannot make $99.999999
  // accidentally miss (or cross) a $100.00 policy boundary.
  return Math.round(merchandiseSubtotal * 100)
    >= Math.round(threshold * 100);
}

export interface ShippingSettlement {
  /** Amount shown to and collected from the buyer. */
  buyerCharge: number;
  /** Amount paid by the platform on the buyer's behalf. */
  platformSubsidy: number;
  /** Shipping revenue credited to the seller before seller fees. */
  sellerCredit: number;
}

/**
 * Splits one shipping quote between buyer, platform and seller.
 *
 * Platform-sponsored free shipping is a marketplace delivery expense: the
 * buyer pays zero and the platform funds the quote, but that quote is not
 * seller revenue. A coupon waiver keeps the pre-existing seller-funded
 * behaviour. When both policies apply, the platform still records the full
 * delivery subsidy while the seller receives no shipping credit.
 */
export function resolveShippingSettlement(
  quotedCost: number,
  options: {
    platformSponsored: boolean;
    couponWaived?: boolean;
  },
): ShippingSettlement {
  const safeQuote = Number.isFinite(quotedCost)
    ? Math.max(0, Math.round(quotedCost * 100) / 100)
    : 0;

  if (options.platformSponsored) {
    return {
      buyerCharge: 0,
      platformSubsidy: safeQuote,
      sellerCredit: 0,
    };
  }

  if (options.couponWaived) {
    return { buyerCharge: 0, platformSubsidy: 0, sellerCredit: 0 };
  }

  return {
    buyerCharge: safeQuote,
    platformSubsidy: 0,
    sellerCredit: safeQuote,
  };
}
