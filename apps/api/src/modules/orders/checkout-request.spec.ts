import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, CheckoutRequest } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CheckoutDto } from './dto/checkout.dto';
import { checkoutIdentity, checkoutPayloadHash, checkoutCartFingerprint, checkoutResponse, recoverCheckoutRequest } from './checkout-request';

const key = 'checkout-request-fixture';
const identity = checkoutIdentity(key, 'buyer');
const dto = { idempotencyKey: key, guestEmail: 'synthetic@example.test', note: 'Synthetic request' };
const receipt = { id: 'receipt', ...identity, payloadHash: checkoutPayloadHash(dto), cartId: 'cart',
  cartFingerprint: 'a'.repeat(64), orderId: 'order', orderNumber: 'EZH-TEST', paymentRequired: false,
  initialStatus: 'CONFIRMED', totalMinor: 1549n, createdAt: new Date() } satisfies CheckoutRequest;
function fixture(record: CheckoutRequest | null = receipt, order: { status: string; adminArchivedAt: Date | null } | null = { status: 'CONFIRMED', adminArchivedAt: null }) {
  const raw = { checkoutRequest: { findUnique: jest.fn().mockResolvedValue(record) }, order: { findUnique: jest.fn().mockResolvedValue(order) } };
  return { raw, tx: raw as unknown as Prisma.TransactionClient };
}

describe('scoped immutable checkout request recovery', () => {
  it('binds opaque identity to account or guest cart cookie, not email', () => {
    expect(checkoutIdentity(key, 'buyer')).toEqual(checkoutIdentity(key, 'buyer', 'different-cookie'));
    expect(checkoutIdentity(key, 'other')).not.toEqual(identity);
    expect(checkoutIdentity(key, undefined, 'cookie-a')).not.toEqual(checkoutIdentity(key, undefined, 'cookie-b'));
    expect(JSON.stringify(identity)).not.toContain('buyer');
    expect(() => checkoutIdentity(key)).toThrow('account or cart session');
  });
  it.each(['', 'short', 'a'.repeat(81), 'bad/key00000000', 'key with spaces'])('rejects invalid key %s', invalid => {
    expect(() => checkoutIdentity(invalid, 'buyer')).toThrow('Invalid checkout request');
  });
  it('hashes contact details without persisting them and ignores key when hashing the payload', () => {
    expect(checkoutPayloadHash(dto)).toMatch(/^[a-f0-9]{64}$/);
    expect(checkoutPayloadHash(dto)).toBe(checkoutPayloadHash({ ...dto, idempotencyKey: 'another-request-key' }));
    expect(checkoutPayloadHash(dto)).not.toBe(checkoutPayloadHash({ ...dto, guestEmail: 'other@example.test' }));
  });
  it('returns the original response after the cart was cleared and order advanced', async () => {
    const { tx, raw } = fixture(receipt, { status: 'IN_PRODUCTION', adminArchivedAt: null });
    await expect(recoverCheckoutRequest(tx, identity, receipt.payloadHash)).resolves.toEqual({
      orderId: 'order', orderNumber: 'EZH-TEST', paymentRequired: false, clientSecret: null, status: 'CONFIRMED', total: 15.49,
    });
    expect(raw.order.findUnique).toHaveBeenCalledWith({ where: { id: 'order' }, select: { status: true, adminArchivedAt: true } });
  });
  it('blocks changed details before reading order data', async () => {
    const { tx, raw } = fixture();
    await expect(recoverCheckoutRequest(tx, identity, 'b'.repeat(64))).rejects.toBeInstanceOf(ConflictException);
    expect(raw.order.findUnique).not.toHaveBeenCalled();
  });
  it('hides a mismatched scope rather than leaking original order data', async () => {
    const { tx, raw } = fixture({ ...receipt, scopeHash: 'b'.repeat(64) });
    await expect(recoverCheckoutRequest(tx, identity)).rejects.toBeInstanceOf(NotFoundException);
    expect(raw.order.findUnique).not.toHaveBeenCalled();
  });
  it.each(['CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'DISPUTED'])('never revives closed order %s', async status => {
    await expect(recoverCheckoutRequest(fixture(receipt, { status, adminArchivedAt: null }).tx, identity)).rejects.toBeInstanceOf(ConflictException);
  });
  it('keeps deleted or archived order identities consumed', async () => {
    await expect(recoverCheckoutRequest(fixture(receipt, null).tx, identity)).rejects.toBeInstanceOf(ConflictException);
    await expect(recoverCheckoutRequest(fixture(receipt, { status: 'CONFIRMED', adminArchivedAt: new Date() }).tx, identity)).rejects.toBeInstanceOf(ConflictException);
  });
  it('returns null only when no receipt exists', async () => {
    const { tx, raw } = fixture(null);
    await expect(recoverCheckoutRequest(tx, identity)).resolves.toBeNull();
    expect(raw.order.findUnique).not.toHaveBeenCalled();
  });
  it('fingerprints the original cart independent of row order and binds personalization/price/quantity', () => {
    const item = { id: 'line', productId: 'product', variantId: null, quantity: 1, unitPrice: new Prisma.Decimal('10'), customizationData: { text: 'Synthetic' } };
    const other = { ...item, id: 'second' };
    expect(checkoutCartFingerprint([item, other])).toBe(checkoutCartFingerprint([other, item]));
    for (const changed of [{ ...item, quantity: 2 }, { ...item, unitPrice: new Prisma.Decimal('11') }, { ...item, customizationData: { text: 'Changed' } }]) {
      expect(checkoutCartFingerprint([item])).not.toBe(checkoutCartFingerprint([changed]));
    }
  });
  it('checks exact integer minor amounts including maximum Order decimal precision', () => {
    expect(checkoutResponse({ ...receipt, totalMinor: 9_999_999_999n }).total).toBe(99_999_999.99);
    expect(() => checkoutResponse({ ...receipt, totalMinor: -1n })).toThrow();
    expect(() => checkoutResponse({ ...receipt, totalMinor: 10_000_000_000n })).toThrow();
  });
  it('requires a valid request identity in the HTTP DTO', async () => {
    expect(await validate(plainToInstance(CheckoutDto, dto))).toHaveLength(0);
    for (const value of [{}, { idempotencyKey: 'bad' }, { idempotencyKey: 123 }]) {
      expect((await validate(plainToInstance(CheckoutDto, value))).some(error => error.property === 'idempotencyKey')).toBe(true);
    }
  });
});
