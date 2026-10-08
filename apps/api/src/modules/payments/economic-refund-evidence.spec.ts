import { RefundExpectation, verifyRefundEvidence } from './economic-refund-evidence';

const stripe: RefundExpectation = { operationId: 'refund-op', captureId: 'capture', captureOperationId: 'capture-op',
  quoteHash: 'a'.repeat(64), orderId: 'order', provider: 'STRIPE', providerAccount: 'acct_fixture', provenance: 'TEST',
  captureReference: 'ch_fixture', paymentReference: 'pi_fixture', refundReference: 're_fixture',
  currency: 'USD', minorExponent: 2, amountMinor: '100', capturedMinor: '200' };
function stripeRaw() {
  return { refund: { id: 're_fixture', charge: 'ch_fixture', payment_intent: 'pi_fixture', currency: 'usd', amount: 100,
    status: 'succeeded', metadata: { economicRefundOperationId: 'refund-op', economicCaptureId: 'capture', quoteHash: stripe.quoteHash } },
  original: { id: 'ch_fixture', payment_intent: 'pi_fixture', livemode: false, paid: true, captured: true, disputed: false,
    currency: 'usd', amount_captured: 200, amount_refunded: 100 } };
}
const paypal: RefundExpectation = { ...stripe, provider: 'PAYPAL', providerAccount: 'merchant',
  captureReference: 'CAPTURE', paymentReference: 'ORDER', refundReference: 'REFUND' };
function paypalRaw() {
  return { refund: { id: 'REFUND', status: 'COMPLETED', invoice_id: 'refund-op', amount: { currency_code: 'USD', value: '1.00' },
    links: [{ rel: 'up', method: 'GET', href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE' }] },
  original: { id: 'CAPTURE', status: 'PARTIALLY_REFUNDED', invoice_id: paypal.quoteHash, custom_id: 'capture-op',
    payee: { merchant_id: 'merchant' }, supplementary_data: { related_ids: { order_id: 'ORDER' } }, amount: { currency_code: 'USD', value: '2.00' } } };
}

describe('independently retrieved refund evidence (synthetic, no provider network)', () => {
  it('accepts completed Stripe/PayPal refunds and fingerprints only the exact binding', () => {
    expect(verifyRefundEvidence(stripeRaw(),stripe,stripe)).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyRefundEvidence(paypalRaw(),paypal,paypal)).toMatch(/^[a-f0-9]{64}$/);
  });
  it.each(['account', 'mode', 'provider'])('refuses foreign reader %s before normalization', field => {
    const scope = { provider: stripe.provider, providerAccount: stripe.providerAccount, provenance: stripe.provenance };
    if (field === 'account') scope.providerAccount='foreign';
    if (field === 'mode') scope.provenance='LIVE';
    if (field === 'provider') scope.provider='PAYPAL';
    expect(() => verifyRefundEvidence(stripeRaw(),stripe,scope)).toThrow('account/mode');
  });
  it.each(['pending', 'failed', 'charge', 'payment', 'amount', 'unsafe', 'metadata', 'mode', 'dispute', 'refunded'])('rejects mismatched Stripe %s', field => {
    const raw=stripeRaw();
    if (field === 'pending' || field === 'failed') raw.refund.status=field;
    if (field === 'charge') raw.refund.charge='ch_foreign';
    if (field === 'payment') raw.refund.payment_intent='pi_foreign';
    if (field === 'amount') raw.refund.amount=101;
    if (field === 'unsafe') raw.refund.amount=Number.MAX_SAFE_INTEGER+1;
    if (field === 'metadata') raw.refund.metadata.economicRefundOperationId='foreign';
    if (field === 'mode') raw.original.livemode=true;
    if (field === 'dispute') raw.original.disputed=true;
    if (field === 'refunded') raw.original.amount_refunded=0;
    expect(() => verifyRefundEvidence(raw,stripe,stripe)).toThrow();
  });
  it.each(['pending', 'amount', 'currency', 'invoice', 'merchant', 'order', 'operation', 'originalAmount', 'foreignLink', 'evilOrigin', 'query', 'liveLink'])('rejects mismatched PayPal %s including untrusted links', field => {
    const raw=paypalRaw();
    if (field === 'pending') raw.refund.status='PENDING';
    if (field === 'amount') raw.refund.amount.value='1.01';
    if (field === 'currency') raw.refund.amount.currency_code='EUR';
    if (field === 'invoice') raw.refund.invoice_id='foreign';
    if (field === 'merchant') raw.original.payee.merchant_id='foreign';
    if (field === 'order') raw.original.supplementary_data.related_ids.order_id='FOREIGN';
    if (field === 'operation') raw.original.custom_id='foreign';
    if (field === 'originalAmount') raw.original.amount.value='1.99';
    if (field === 'foreignLink') raw.refund.links[0].href='https://api-m.sandbox.paypal.com/v2/payments/captures/FOREIGN';
    if (field === 'evilOrigin') raw.refund.links[0].href='https://evil.test/v2/payments/captures/CAPTURE';
    if (field === 'query') raw.refund.links[0].href+='?redirect=evil';
    if (field === 'liveLink') raw.refund.links[0].href='https://api-m.paypal.com/v2/payments/captures/CAPTURE';
    expect(() => verifyRefundEvidence(raw,paypal,paypal)).toThrow('reconciliation');
  });
});
