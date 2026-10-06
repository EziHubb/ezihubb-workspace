import { inventoryPools, InventoryLine } from './inventory-policy';

const product = { id: 'p1', quantity: 10, trackInventory: true, variationSettings: null };
function line(id: string, quantity: number): InventoryLine { return { id, quantity, product, variant: null }; }

describe('prospective inventory pool authority', () => {
  it('sums all lines sharing a product pool, not only the first product occurrence', () => {
    expect(inventoryPools([line('a', 2), line('b', 3)])).toEqual([{
      productId: 'p1', variantId: null, poolKey: 'PRODUCT:p1', target: 'PRODUCT', quantity: 5,
      lines: [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 3 }],
    }]);
  });
  it('uses only variant stock when quantity varies and does not double decrement the product pool', () => {
    const variantProduct = { ...product, quantity: null, trackInventory: false,
      variationSettings: { enableVariations: true, variesBy: ['quantity'] } };
    const pools = inventoryPools([
      { ...line('a', 2), product: variantProduct, variant: { id: 'v1', productId: 'p1', quantity: 3, isAvailable: true } },
      { ...line('b', 1), product: variantProduct, variant: { id: 'v2', productId: 'p1', quantity: 2, isAvailable: true } },
    ]);
    expect(pools.map(pool => [pool.target, pool.variantId, pool.quantity])).toEqual([
      ['VARIANT', 'v1', 2], ['VARIANT', 'v2', 1],
    ]);
  });
  it('treats untracked products as explicit unlimited but never a null finite pool', () => {
    expect(inventoryPools([{ ...line('a', 2), product: { ...product, trackInventory: false, quantity: null } }])[0].target)
      .toBe('UNLIMITED');
    expect(() => inventoryPools([{ ...line('a', 2), product: { ...product, quantity: null } }])).toThrow('Finite inventory');
    expect(() => inventoryPools([{ ...line('a', 2), product: { ...product,
      variationSettings: { enableVariations: true, variesBy: ['quantity'] } },
      variant: { id: 'v1', productId: 'p1', quantity: null, isAvailable: true },
    }])).toThrow('Finite inventory');
  });
  it('rejects missing/foreign/hidden variants and bad quantities', () => {
    expect(() => inventoryPools([{ ...line('a', 1), product: { ...product,
      variationSettings: { enableVariations: true, variesBy: ['quantity'] } } }])).toThrow();
    for (const variant of [
      { id: 'v1', productId: 'foreign', quantity: 5, isAvailable: true },
      { id: 'v1', productId: 'p1', quantity: 5, isAvailable: false },
    ]) expect(() => inventoryPools([{ ...line('a', 1), variant }])).toThrow();
    for (const quantity of [0, -1, 1.5, 2147483648]) expect(() => inventoryPools([line('a', quantity)])).toThrow();
    expect(() => inventoryPools([line('a', 1), line('a', 1)])).toThrow();
  });
  it('snapshots a stable target when source settings later change', () => {
    const mutableProduct = { ...product };
    const pools = inventoryPools([{ ...line('a', 1), product: mutableProduct }]);
    mutableProduct.trackInventory = false;
    expect(pools[0]).toMatchObject({ target: 'PRODUCT', poolKey: 'PRODUCT:p1', quantity: 1 });
  });
});
