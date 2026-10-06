import { EconomicStockTarget } from '@prisma/client';

export type InventoryLine = {
  id: string;
  quantity: number;
  product: {
    id: string;
    quantity: number | null;
    trackInventory: boolean;
    variationSettings: { enableVariations: boolean; variesBy: string[] } | null;
  } | null;
  variant: { id: string; productId: string; quantity: number | null; isAvailable: boolean } | null;
};

export type StockPool = {
  productId: string;
  variantId: string | null;
  poolKey: string;
  target: EconomicStockTarget;
  quantity: number;
  lines: Array<{ id: string; quantity: number }>;
};

/** Snapshot once, never recompute a pool from changed settings on release. */
export function inventoryPools(lines: ReadonlyArray<InventoryLine>): StockPool[] {
  const pools = new Map<string, StockPool>();
  const seen = new Set<string>();
  for (const line of lines) {
    if (!line.id || seen.has(line.id) || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error('Invalid or duplicate inventory line');
    }
    seen.add(line.id);
    const product = line.product;
    if (!product) throw new Error('Inventory product is unavailable');
    if (line.variant && (line.variant.productId !== product.id || !line.variant.isAvailable)) {
      throw new Error('Inventory variant is unavailable');
    }
    const variantQuantity = product.variationSettings?.enableVariations
      && product.variationSettings.variesBy.includes('quantity');
    if (variantQuantity && !line.variant) throw new Error('Quantity variation requires a selected variant');
    const target: EconomicStockTarget = variantQuantity ? 'VARIANT'
      : product.trackInventory ? 'PRODUCT' : 'UNLIMITED';
    const quantity = variantQuantity ? line.variant?.quantity ?? null : product.quantity;
    if (target !== 'UNLIMITED' && (quantity === null || !Number.isSafeInteger(quantity) || quantity < 0)) {
      throw new Error('Finite inventory requires a valid quantity');
    }
    const variantId = target === 'VARIANT' ? line.variant?.id ?? null : null;
    if (target === 'VARIANT' && !variantId) throw new Error('Missing variant inventory target');
    const poolKey = `${target}:${variantId ?? product.id}`;
    const pool = pools.get(poolKey) ?? {
      productId: product.id, variantId, poolKey, target, quantity: 0, lines: [],
    };
    pool.quantity += line.quantity;
    if (!Number.isSafeInteger(pool.quantity) || pool.quantity > 2147483647) {
      throw new Error('Inventory quantity exceeds database capacity');
    }
    pool.lines.push({ id: line.id, quantity: line.quantity });
    pools.set(poolKey, pool);
  }
  return [...pools.values()].sort((a, b) => a.poolKey < b.poolKey ? -1 : a.poolKey > b.poolKey ? 1 : 0)
    .map(pool => ({ ...pool, lines: pool.lines.sort((a, b) => a.id < b.id ? -1 : 1) }));
}
