import { EconomicPaymentsService } from './economic-payments.service';

function fixture() {
  const context = { id: 'context', provenance: 'TEST' };
  const capture = { id: 'capture', provider: 'STRIPE', providerAccount: 'acct_test', providerReference: 'ch_test', currency: 'USD', amountMinor: 200n };
  const prisma = { payment: { findFirst: jest.fn().mockResolvedValue({ orderId: 'order' }) },
    economicRefundRequest: { findMany: jest.fn().mockResolvedValue([{ operationId: 'refund-op', operation: { providerReference: 're_test' } }]) },
    economicCapture: { findUnique: jest.fn().mockResolvedValue(capture) },
    economicRefund: { findMany: jest.fn().mockResolvedValue([{ amountMinor: 80n }]) } };
  const original = { id: 'ch_test', payment_intent: 'pi_test', livemode: false, currency: 'usd', disputed: false,
    paid: true, captured: true, amount_captured: 200, amount_refunded: 80 };
  const stripe = { accounts: { retrieve: jest.fn().mockResolvedValue({ id: 'acct_test' }) }, charges: { retrieve: jest.fn().mockResolvedValue(original) } };
  const refunds = { reconcileWebhook: jest.fn().mockResolvedValue(true) };
  const hold = jest.fn().mockRejectedValue(new Error('Requires reconciliation'));
  const service = Object.assign(Object.create(EconomicPaymentsService.prototype), {
    prisma, refunds, hasContext: jest.fn().mockResolvedValue(context), stripeScope: jest.fn().mockReturnValue({ account: 'acct_test', stripe }), holdForReconciliation: hold,
  }) as EconomicPaymentsService;
  return { prisma, capture, original, stripe, refunds, hold, service };
}
describe('existing-refund webhook reconciliation without redispatch', () => {
  it('acknowledges Stripe cumulative refunds only after fresh totals match immutable settlements', async () => {
    const h = fixture();
    expect(await h.service.stripeWebhook('charge.refunded', { payment_intent: 'pi_test', amount_refunded: 999 })).toBe(true);
    expect(h.refunds.reconcileWebhook).toHaveBeenCalledWith('context', 'STRIPE', 're_test', 'refund-op');
    expect(h.stripe.charges.retrieve).toHaveBeenCalledWith('ch_test');
    expect(h.hold).not.toHaveBeenCalled(); // Payload amount is not provider proof.
  });
  it.each([['amount_refunded', 81], ['livemode', true], ['disputed', true], ['amount_captured', 201]])('holds changed original Stripe evidence (%s)', async (field, value) => {
    const h = fixture(); Object.assign(h.original, { [field]: value });
    await expect(h.service.stripeWebhook('charge.refunded', { payment_intent: 'pi_test' })).rejects.toThrow('reconciliation');
    expect(h.hold).toHaveBeenCalledWith('context');
  });
  it('uses a PayPal refund ID only to independently reconcile a previously dispatched request', async () => {
    const h = fixture();
    expect(await h.service.paypalWebhook('PAYMENT.CAPTURE.REFUNDED', { id: 'PPREFUND', invoice_id: 'refund-op',
      links: [{ rel: 'up', href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/PPCAPTURE' }] })).toBe(true);
    expect(h.refunds.reconcileWebhook).toHaveBeenCalledWith('context', 'PAYPAL', 'PPREFUND', 'refund-op');
    expect(h.hold).not.toHaveBeenCalled();
    h.refunds.reconcileWebhook.mockResolvedValue(false);
    await expect(h.service.paypalWebhook('PAYMENT.CAPTURE.REFUNDED', { id: 'UNKNOWN', invoice_id: 'unplanned',
      supplementary_data: { related_ids: { order_id: 'PPORDER' } } })).rejects.toThrow('reconciliation');
  });
  it('never automatically clears an earlier dispute or unknown-adjustment hold', async () => {
    const h = fixture();
    await expect(h.service.stripeWebhook('charge.dispute.closed', { payment_intent: 'pi_test' })).rejects.toThrow('reconciliation');
    expect(h.hold).toHaveBeenCalledWith('context');
    expect(h.refunds.reconcileWebhook).not.toHaveBeenCalled();
  });
});
