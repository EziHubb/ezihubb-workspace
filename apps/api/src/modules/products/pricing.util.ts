import { PrismaService } from '../../prisma/prisma.service';

export interface EffectivePrice {
  /** Final unit price after the best active auto-apply sale, if any. */
  price: number;
  /** The undiscounted listing/variant price. */
  originalPrice: number;
  /** Which Promotion produced `price`, or null if no sale applies. */
  promotionId: string | null;
  /** The winning promo's own terms — lets a caller re-apply the same discount to a different price (e.g. a selected variant), not just `basePrice`. */
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | null;
  discountValue: number | null;
}

/**
 * Resolves the best active `autoApply` sale (Etsy "Set up a sale" — shop-wide
 * or listing-specific) for a single product, and returns the price a buyer
 * should actually be charged. Used identically for display (product page,
 * cart) and checkout — checkout MUST call this itself rather than trust a
 * client-supplied discounted price, same discipline already applied to
 * coupon codes in OrdersService.checkout().
 *
 * A buyer's shipping country, if provided, excludes sales scoped to a
 * different country (Promotion.country — null means "Everywhere").
 */
export async function getEffectivePrice(
  prisma: PrismaService,
  productId: string,
  storeId: string,
  basePrice: number,
  shippingCountry?: string | null,
): Promise<EffectivePrice> {
  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: {
      storeId,
      autoApply: true,
      isActive: true,
      // FREE_SHIPPING doesn't discount the unit price at all (it waives
      // shipping, a separate line item) — including it here would fall
      // through to the FIXED_AMOUNT branch below and wrongly subtract its
      // (usually unset/0) `value` from basePrice.
      type: { in: ['PERCENTAGE', 'FIXED_AMOUNT'] },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    select: {
      id: true, type: true, value: true, scope: true, country: true,
      products: { where: { productId }, select: { productId: true } },
    },
  });

  const applicable = promos.filter((p) => {
    if (p.scope === 'SPECIFIC_LISTINGS' && p.products.length === 0) return false;
    if (p.country && shippingCountry && p.country.toUpperCase() !== shippingCountry.toUpperCase()) return false;
    return true;
  });

  let best: EffectivePrice = { price: basePrice, originalPrice: basePrice, promotionId: null, discountType: null, discountValue: null };
  for (const promo of applicable) {
    const discounted = promo.type === 'PERCENTAGE'
      ? basePrice - Math.round(basePrice * Number(promo.value)) / 100
      : Math.max(0, basePrice - Number(promo.value));
    const rounded = Math.round(Math.max(0, discounted) * 100) / 100;
    if (rounded < best.price) {
      best = {
        price: rounded,
        originalPrice: basePrice,
        promotionId: promo.id,
        discountType: promo.type as 'PERCENTAGE' | 'FIXED_AMOUNT',
        discountValue: Number(promo.value),
      };
    }
  }
  return best;
}

/** Batch variant for listing grids/search results — one query for N products instead of N queries. */
export async function getEffectivePrices(
  prisma: PrismaService,
  productIds: string[],
  storeId: string,
  shippingCountry?: string | null,
): Promise<Map<string, { promotionId: string; type: string; value: number; scope: string; country: string | null }[]>> {
  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: {
      storeId,
      autoApply: true,
      isActive: true,
      type: { in: ['PERCENTAGE', 'FIXED_AMOUNT'] },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    select: {
      id: true, type: true, value: true, scope: true, country: true,
      products: { where: { productId: { in: productIds } }, select: { productId: true } },
    },
  });

  const byProduct = new Map<string, { promotionId: string; type: string; value: number; scope: string; country: string | null }[]>();
  for (const promo of promos) {
    if (promo.country && shippingCountry && promo.country.toUpperCase() !== shippingCountry.toUpperCase()) continue;
    const entry = { promotionId: promo.id, type: promo.type as string, value: Number(promo.value), scope: promo.scope as string, country: promo.country };
    if (promo.scope === 'SHOP_WIDE') {
      for (const productId of productIds) {
        if (!byProduct.has(productId)) byProduct.set(productId, []);
        byProduct.get(productId)!.push(entry);
      }
    } else {
      for (const p of promo.products) {
        if (!byProduct.has(p.productId)) byProduct.set(p.productId, []);
        byProduct.get(p.productId)!.push(entry);
      }
    }
  }
  return byProduct;
}

export function applyBestPromo(
  basePrice: number,
  promos: { type: string; value: number }[] | undefined,
): number {
  if (!promos || promos.length === 0) return basePrice;
  let best = basePrice;
  for (const promo of promos) {
    const discounted = promo.type === 'PERCENTAGE'
      ? basePrice - Math.round(basePrice * promo.value) / 100
      : Math.max(0, basePrice - promo.value);
    const rounded = Math.round(Math.max(0, discounted) * 100) / 100;
    if (rounded < best) best = rounded;
  }
  return best;
}
