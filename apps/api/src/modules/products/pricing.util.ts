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

/**
 * Sales for a page of listings that may span many shops.
 *
 * getEffectivePrices takes one storeId, because a promotion belongs to a shop.
 * A marketplace grid does not: it mixes shops freely, so the ids have to be
 * grouped first and the queries run one per shop. Checkout already does this
 * by hand for a cart; grids and search need the same thing, and duplicating it
 * a third time is how the three drift apart.
 */
export async function getSalesForListings(
  prisma: PrismaService,
  listings: { id: string; storeId: string | null }[],
  shippingCountry?: string | null,
): Promise<Map<string, { promotionId: string; type: string; value: number; scope: string; country: string | null }[]>> {
  const byStore = new Map<string, string[]>();
  for (const l of listings) {
    if (!l.storeId) continue;                       // platform listings have no shop, so no shop sale
    const ids = byStore.get(l.storeId) ?? [];
    ids.push(l.id);
    byStore.set(l.storeId, ids);
  }

  const merged = new Map<string, { promotionId: string; type: string; value: number; scope: string; country: string | null }[]>();
  await Promise.all(
    [...byStore.entries()].map(async ([storeId, ids]) => {
      const result = await getEffectivePrices(prisma, ids, storeId, shippingCountry);
      for (const [productId, promos] of result) merged.set(productId, promos);
    }),
  );
  return merged;
}

/** What a listing's active sale looks like to a renderer, or null if none applies. */
export interface ListingSale {
  /** The price after the discount. */
  price: number;
  /** The price before it — the figure to strike through. */
  originalPrice: number;
  /** Whole percent off, for the label beside them. */
  discountPercent: number;
}

/**
 * The sale as it should be shown for one listing.
 *
 * The caller supplies the price actually shown on the card. For a listing with
 * variants that is its lowest available variant price; otherwise it is the
 * listing base price. Applying the promotion to that same number keeps the
 * "From" price, struck price and percentage internally consistent. Checkout
 * still recomputes the promotion against the concrete variant the buyer chose.
 *
 * Returns null rather than a zero discount when nothing applies, so a caller
 * cannot accidentally render "0% off".
 */
export function listingSale(
  displayPrice: number,
  promos: { type: string; value: number }[] | undefined,
): ListingSale | null {
  const price = applyBestPromo(displayPrice, promos);
  if (!(price < displayPrice) || displayPrice <= 0) return null;
  return {
    price,
    originalPrice: displayPrice,
    discountPercent: Math.round((1 - price / displayPrice) * 100),
  };
}

/**
 * Attaches the running sale to a page of already-mapped listings.
 *
 * One call per mapping site rather than a `sale:` line inside each of them.
 * ProductListItemDto is built in three separate places — findAll,
 * ProductsService.toListItems and SearchService.toListItems — and the field is
 * optional, so a site that forgot it would compile perfectly and just never
 * show a discount. Spreading here means there is nothing to forget.
 */
export async function withListingSales<
  T extends {
    id: string;
    storeId: string | null;
    basePrice: number;
    minPrice?: number | null;
  },
>(
  prisma: PrismaService,
  items: T[],
  shippingCountry?: string | null,
): Promise<(T & { sale: ListingSale | null })[]> {
  if (items.length === 0) return [];
  const promos = await getSalesForListings(prisma, items, shippingCountry);
  return items.map((item) => ({
    ...item,
    sale: listingSale(item.minPrice ?? item.basePrice, promos.get(item.id)),
  }));
}
