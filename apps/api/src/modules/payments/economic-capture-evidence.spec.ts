import { CaptureExpectation, paypalCaptureEvidence, stripeCaptureEvidence } from './economic-capture-evidence';

const expected: CaptureExpectation = {
  operationId: 'op1', orderId: 'order1', quoteHash: 'a'.repeat(64), provider: 'STRIPE',
  providerAccount: 'acct_test', provenance: 'TEST', providerPaymentId: 'pi_test', currency: 'USD', minorExponent: 2, amountMinor: '11999',
};
const scope = { providerAccount: 'acct_test', provenance: 'TEST' as const };
function stripeFixture() {
  return {
    id: 'pi_test', status: 'succeeded', livemode: false, amount: 11999, amount_received: 11999, currency: 'usd',
    metadata: { orderId: 'order1', economicOperationId: 'op1', quoteHash: 'a'.repeat(64) },
    latest_charge: { id: 'ch_test', livemode: false, payment_intent: 'pi_test', paid: true, captured: true,
      status: 'succeeded', amount_captured: 11999, currency: 'usd', amount_refunded: 0, refunded: false, disputed: false },
  };
}
const paypalExpected: CaptureExpectation = { ...expected, provider: 'PAYPAL', providerAccount: 'merchant1', providerPaymentId: 'paypalOrder1' };
const paypalScope = { ...scope, providerAccount: 'merchant1' };
function paypalFixture() {
  return { id: 'paypalCapture1', status: 'COMPLETED', final_capture: true,
    payee: { merchant_id: 'merchant1' }, supplementary_data: { related_ids: { order_id: 'paypalOrder1' } },
    custom_id: 'op1', invoice_id: 'a'.repeat(64), amount: { value: '119.99', currency_code: 'USD' } };
}

describe('capture evidence checks on server-retrieved provider responses', () => {
  it('normalizes equivalent provider captures and excludes raw provider PII', () => {
    const stripe = stripeCaptureEvidence({ ...stripeFixture(), receipt_email: 'omit' }, expected, scope);
    expect(stripe).toMatchObject({ providerReference: 'ch_test', amountMinor: '11999' });
    expect(stripe.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stripe)).not.toContain('receipt_email');
    expect(paypalCaptureEvidence(paypalFixture(), paypalExpected, paypalScope)).toMatchObject({
      providerReference: 'paypalCapture1', amountMinor: '11999', provider: 'PAYPAL',
    });
  });
  it.each([
    { amount_received: 0 }, { amount: 11998 }, { currency: 'eur' }, { status: 'processing' },
    { id: 'pi_foreign' }, { livemode: true }, { latest_charge: 'ch_test' },
    { metadata: { orderId: 'other', economicOperationId: 'op1', quoteHash: 'a'.repeat(64) } },
  ])('rejects a Stripe mismatch %p', change => {
    expect(() => stripeCaptureEvidence({ ...stripeFixture(), ...change }, expected, scope)).toThrow();
  });
  it.each([
    { amount_captured: 11998 }, { captured: false }, { paid: false }, { disputed: true }, { amount_refunded: 1 },
    { payment_intent: 'pi_foreign' }, { status: 'failed' }, { livemode: true },
  ])('requires matching captured charge evidence %p', change => {
    const fixture = stripeFixture();
    expect(() => stripeCaptureEvidence({ ...fixture, latest_charge: { ...fixture.latest_charge, ...change } }, expected, scope)).toThrow();
  });
  it.each([
    { status: 'PENDING' }, { status: 'PARTIALLY_REFUNDED' }, { final_capture: false }, { payee: { merchant_id: 'foreign' } },
    { custom_id: 'foreign-op' }, { invoice_id: 'wrong-hash' }, { amount: { value: '119.98', currency_code: 'USD' } },
    { amount: { value: '119.99', currency_code: 'EUR' } }, { supplementary_data: { related_ids: { order_id: 'foreign-order' } } },
  ])('rejects a PayPal mismatch %p', change => {
    expect(() => paypalCaptureEvidence({ ...paypalFixture(), ...change }, paypalExpected, paypalScope)).toThrow();
  });
  it('rejects cross-account/cross-mode reader scopes and unsafe numeric values', () => {
    expect(() => stripeCaptureEvidence(stripeFixture(), expected, { ...scope, provenance: 'LIVE' })).toThrow('mismatch');
    expect(() => stripeCaptureEvidence(stripeFixture(), expected, { ...scope, providerAccount: 'foreign' })).toThrow('mismatch');
    expect(() => stripeCaptureEvidence({ ...stripeFixture(), amount_received: Number.MAX_SAFE_INTEGER + 1 }, expected, scope)).toThrow();
  });
});
