import { FrozenPodPayload, verifyPrintifyPod } from './economic-printify-proof';
const frozen: FrozenPodPayload = { version: 'pod-v1', address: { first_name: 'Buyer', last_name: 'Name', address1: 'Street',
  country: 'US', city: 'City', zip: '12345', region: 'TX', email: 'buyer@example.test', phone: '' },
  items: [{ lineId: 'line', productId: 'product', variantId: null, externalProductId: 'external', externalVariantId: 1, quantity: 2 }] };
function original() { return { id: 'original', address_to: { ...frozen.address },
  line_items: [{ product_id: 'external', variant_id: 1, quantity: 2, metadata: { external_id: 'effect-line' } }] }; }
describe('Printify independent original resource proof', () => {
  it('checks all original fields but does not depend on mutable status or price', () => {
    const hash = verifyPrintifyPod(original(), 'effect', 'original', frozen);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyPrintifyPod({ ...original(), status: 'fulfilled', total_price: 999 }, 'effect', 'original', frozen)).toBe(hash);
  });
  it.each(['product_id', 'variant_id', 'quantity', 'metadata'])('rejects changed original line %s', field => {
    const value = original(); Object.assign(value.line_items[0], { [field]: field === 'metadata' ? { external_id: 'foreign' } : 'foreign' });
    expect(() => verifyPrintifyPod(value, 'effect', 'original', frozen)).toThrow('line/reference');
  });
  it('rejects wrong ID, additional items, address mismatch and forged external_id echo', () => {
    expect(() => verifyPrintifyPod({ ...original(), id: 'foreign' }, 'effect', 'original', frozen)).toThrow('resource');
    const extra = original(); extra.line_items.push(extra.line_items[0]);
    expect(() => verifyPrintifyPod(extra, 'effect', 'original', frozen)).toThrow('resource');
    expect(() => verifyPrintifyPod({ ...original(), address_to: { ...frozen.address, zip: 'foreign' } }, 'effect', 'original', frozen)).toThrow('address');
    expect(() => verifyPrintifyPod({ ...original(), external_id: 'effect', line_items: [{ ...original().line_items[0], metadata: {} }] }, 'effect', 'original', frozen)).toThrow('line/reference');
  });
});
