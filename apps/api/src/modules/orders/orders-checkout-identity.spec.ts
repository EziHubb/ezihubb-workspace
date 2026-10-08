import { ConflictException, NotFoundException } from '@nestjs/common';
import { CheckoutRequest, Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';
import { checkoutIdentity } from './checkout-request';

function setup() {
  const item = { id: 'line', productId: 'product', variantId: null, quantity: 1, unitPrice: new Prisma.Decimal(10),
    product: { isActive: true, deletedAt: null, productType: 'DIGITAL', basePrice: new Prisma.Decimal(10), storeId: null, name: 'Synthetic download', slug: 'fixture', sku: null, images: [] } };
  let items = [item];
  const cart = { id: 'cart', userId: 'buyer', sessionId: 'guest-session', couponCode: null };
  let receipt: CheckoutRequest | null = null;
  const original = { id: 'order', orderNumber: 'EZH-TEST', status: 'CONFIRMED', total: 10, isDigital: true, adminArchivedAt: null };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: cart.id }]),
    checkoutRequest: {
      findUnique: jest.fn(({ where }: { where: { identityHash: string } }) => receipt?.identityHash === where.identityHash ? receipt : null),
      findFirst: jest.fn<Promise<{ orderId: string } | null>, []>().mockResolvedValue(null),
      create: jest.fn(({ data }: { data: Omit<CheckoutRequest, 'id' | 'createdAt'> }) => { receipt = { ...data, id: 'receipt', createdAt: new Date() }; return receipt; }),
    },
    cart: { findFirst: jest.fn(() => ({ ...cart, items: [...items] })), findUnique: jest.fn(() => cart), update: jest.fn() },
    cartItem: { findMany: jest.fn(() => items), deleteMany: jest.fn(() => { items = []; return { count: 1 }; }) },
    order: { create: jest.fn().mockResolvedValue(original), findUnique: jest.fn(() => receipt ? original : null) },
    orderItem: { createMany: jest.fn() }, orderStatusHistory: { create: jest.fn() },
    platformSettings: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const prisma = { ...tx, $transaction: jest.fn(async (work: (client: unknown) => unknown) => {
    const before = { items, receipt };
    try { return await work(tx); } catch (error) { items = before.items; receipt = before.receipt; throw error; }
  }) };
  const service = Object.create(OrdersService.prototype) as OrdersService;
  Object.assign(service, { prisma, onlinePaymentsEnabled: false, generateOrderNumber: jest.fn().mockResolvedValue('EZH-TEST') });
  return { service, tx, prisma, item, cart, original, setReceipt: (value: CheckoutRequest) => { receipt = value; } };
}
const request = { idempotencyKey: 'synthetic-checkout-request' };
describe('real checkout creation path with transactional request identities (mock database)', () => {
  it('creates once and replays the original total after manual checkout cleared the cart', async () => {
    const { service, tx, item, prisma } = setup();
    const first = await service.checkout(request, 'buyer');
    item.product.basePrice = new Prisma.Decimal(999);
    expect(await service.checkout(request, 'buyer')).toEqual(first);
    expect(first).toMatchObject({ orderId: 'order', status: 'CONFIRMED', total: 10, paymentRequired: false });
    expect(tx.order.create).toHaveBeenCalledTimes(1);
    expect(tx.cart.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.cartItem.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.checkoutRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ totalMinor: 1000n, ...checkoutIdentity(request.idempotencyKey, 'buyer') }) });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
  it('rejects changed payload for the same key before reading a cleared cart', async () => {
    const { service, tx } = setup();
    await service.checkout(request, 'buyer');
    await expect(service.checkout({ ...request, note: 'changed' }, 'buyer')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.create).toHaveBeenCalledTimes(1);
    expect(tx.cart.findFirst).toHaveBeenCalledTimes(1);
  });
  it('a fresh key cannot recreate a manual order from an emptied cart', async () => {
    const { service, tx } = setup();
    await service.checkout(request, 'buyer');
    await expect(service.checkout({ idempotencyKey: 'different-checkout-key' }, 'buyer')).rejects.toThrow('Cart is empty');
    expect(tx.order.create).toHaveBeenCalledTimes(1);
  });
  it('rejects cart changes under the cart lock before creating any order', async () => {
    const { service, tx, item } = setup();
    tx.cartItem.findMany.mockImplementation(() => [{ ...item, quantity: 2 }]);
    await expect(service.checkout(request, 'buyer')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.order.create).not.toHaveBeenCalled();
  });
  it('rejects a coupon/ownership change under the same lock', async () => {
    const { service, tx, cart } = setup();
    tx.cart.findUnique.mockImplementation(() => ({ ...cart, userId: 'another-buyer' }));
    await expect(service.checkout(request, 'buyer')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });
  it('a fresh key cannot clone a captured basket before asynchronous cart cleanup', async () => {
    const { service, tx } = setup();
    tx.checkoutRequest.findFirst.mockResolvedValueOnce({ orderId: 'captured-original' });
    await expect(service.checkout(request, 'buyer')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });
  it('serializable retries replay a receipt written by the winning request, without creating again', async () => {
    const { service, prisma, tx, cart, item } = setup();
    const original = await service.checkout(request, 'buyer');
    tx.checkoutRequest.findUnique.mockReturnValueOnce(null);
    // Model the loser having read the original cart before the winner commits.
    tx.cart.findFirst.mockReturnValueOnce({ ...cart, items: [item] });
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });
    expect(await service.checkout(request, 'buyer')).toEqual(original);
    expect(tx.order.create).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });
  it('receipt failures remain inside the order transaction and do not consume the cart', async () => {
    const { service, tx } = setup();
    tx.checkoutRequest.create.mockImplementationOnce(() => { throw new Error('Synthetic receipt insertion failure'); });
    await expect(service.checkout(request, 'buyer')).rejects.toThrow('Synthetic receipt');
    // Mock rollback models the transaction boundary, not PostgreSQL concurrency proof.
    expect(await service.checkout(request, 'buyer')).toMatchObject({ orderId: 'order', total: 10 });
    expect(tx.cartItem.findMany.mock.results[1].value).toHaveLength(1);
  });
  it('lookup never reveals a different account or guest session original', async () => {
    const { service } = setup();
    await service.checkout(request, 'buyer');
    expect(await service.recoverCheckout(request.idempotencyKey, 'buyer')).toMatchObject({ orderId: 'order' });
    await expect(service.recoverCheckout(request.idempotencyKey, 'another-buyer')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.recoverCheckout(request.idempotencyKey, undefined, 'guest-session')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('guest replay is bound to the original cart cookie', async () => {
    const { service, tx } = setup();
    const guest = { ...request, guestEmail: 'synthetic@example.test' };
    const original = await service.checkout(guest, undefined, 'guest-session');
    expect(await service.checkout(guest, undefined, 'guest-session')).toEqual(original);
    await expect(service.recoverCheckout(guest.idempotencyKey, undefined, 'wrong-cookie')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.order.create).toHaveBeenCalledTimes(1);
  });
  it('capabilities fail closed if online payments are enabled without a configured economic mode', () => {
    const { service } = setup();
    const previous = { enabled: process.env['ECONOMIC_V1_ENABLED'], mode: process.env['ECONOMIC_V1_MODE'] };
    try {
      expect(service.checkoutCapabilities()).toEqual({ version: 'checkout-v1', onlinePaymentsAvailable: false, orderRequestsAvailable: true });
      Object.assign(service, { onlinePaymentsEnabled: true });
      process.env['ECONOMIC_V1_ENABLED'] = 'false';
      expect(service.checkoutCapabilities()).toMatchObject({ onlinePaymentsAvailable: false, orderRequestsAvailable: false });
      process.env['ECONOMIC_V1_ENABLED'] = 'true'; process.env['ECONOMIC_V1_MODE'] = 'TEST';
      expect(service.checkoutCapabilities()).toMatchObject({ onlinePaymentsAvailable: true, orderRequestsAvailable: false });
    } finally {
      const restore: [string, string | undefined][] = [['ECONOMIC_V1_ENABLED',previous.enabled],['ECONOMIC_V1_MODE',previous.mode]];
      for (const [key, value] of restore) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });
});
