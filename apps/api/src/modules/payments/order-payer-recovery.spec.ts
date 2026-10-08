import { OrderPayerService } from './order-payer.service';
import { PrismaService } from '../../prisma/prisma.service';

function fixture(changes: Record<string, unknown> = {}) {
  const order = { id: 'order', orderNumber: 'EZH-TEST', userId: 'buyer', guestEmail: 'private@example.test',
    status: 'PENDING_PAYMENT', adminArchivedAt: null, shippingAddress: 'Private address',
    total: '999', payment: { clientSecret: 'must-not-leak' },
    items: [{ id: 'line', productName: 'Original item', variantName: 'Original option', productImageUrl: null,
      quantity: 2, unitPrice: '10.00', customizationData: { secret: 'private' } }],
    economicContext: { currency: 'USD', minorExponent: 2, quote: { customerTotalMinor: '1500' },
      capture: null, operations: [{ provider: 'PAYPAL', state: 'NEEDS_RECONCILIATION' }] }, ...changes };
  const findUnique = jest.fn().mockResolvedValue(order);
  return { findUnique, service: new OrderPayerService({ order: { findUnique } } as unknown as PrismaService) };
}
describe('payer-authorized frozen checkout recovery', () => {
  it('returns original quote money and bound method, not today’s order/cart or private fields', async () => {
    const { service } = fixture();
    const result = await service.recoverCheckout('order', 'buyer');
    expect(result).toMatchObject({ total: 15, amountMinor: '1500', boundProvider: 'PAYPAL', canContinue: true, paymentStatus: 'PENDING' });
    expect(JSON.stringify(result)).not.toMatch(/private|clientSecret|shippingAddress|customizationData/);
  });
  it.each([undefined, 'another-buyer'])('rejects a different payer (%s)', async caller => {
    const { service } = fixture();
    await expect(service.recoverCheckout('order', caller)).rejects.toThrow('another account');
  });
  it('permits existing guest capability without returning contact details', async () => {
    const { service } = fixture({ userId: null });
    expect((await service.recoverCheckout('order')).orderId).toBe('order');
  });
  it('never promotes paid-like status or an operation string to capture proof', async () => {
    const { service } = fixture({ status: 'CONFIRMED' });
    expect(await service.recoverCheckout('order', 'buyer')).toMatchObject({ paymentStatus: 'PENDING', canContinue: false });
  });
  it('returns verified capture for a pending order without reopening payment', async () => {
    const { service } = fixture({ economicContext: { currency: 'USD', minorExponent: 2,
      quote: { customerTotalMinor: '1500' }, capture: { id: 'capture' }, operations: [] } });
    expect(await service.recoverCheckout('order', 'buyer')).toMatchObject({ paymentStatus: 'VERIFIED', canContinue: false });
  });
  it.each(['CANCELLED', 'REFUND_REQUESTED', 'REFUNDED', 'DISPUTED'])('does not redirect a captured %s order to checkout success', async status => {
    const { service } = fixture({ status, economicContext: { currency: 'USD', minorExponent: 2,
      quote: { customerTotalMinor: '1500' }, capture: { id: 'capture' }, operations: [] } });
    expect(await service.recoverCheckout('order', 'buyer')).toMatchObject({ paymentStatus: 'CLOSED', canContinue: false });
  });
  it('does not reopen archived orders even with capture proof', async () => {
    const { service } = fixture({ adminArchivedAt: new Date(), economicContext: { currency: 'USD', minorExponent: 2,
      quote: { customerTotalMinor: '1500' }, capture: { id: 'capture' }, operations: [] } });
    expect(await service.recoverCheckout('order', 'buyer')).toMatchObject({ paymentStatus: 'CLOSED', canContinue: false });
  });
  it('rejects legacy/manual recovery and malformed original amounts', async () => {
    await expect(fixture({ economicContext: null }).service.recoverCheckout('order', 'buyer')).rejects.toThrow('online checkout recovery');
    await expect(fixture({ economicContext: { currency: 'USD', minorExponent: 2,
      quote: { customerTotalMinor: 15 }, capture: null, operations: [] } }).service.recoverCheckout('order', 'buyer')).rejects.toThrow('Invalid frozen');
  });
});
