import { createHash } from 'node:crypto';
import { EconomicProvider, EconomicProvenance } from '@prisma/client';
import { canonicalEconomicJson, exactMinor } from '../finances/economic-quote';
import { parseMinorUnits } from '../finances/economic-policy';

export type RefundExpectation = {
  operationId: string; captureId: string; captureOperationId: string; quoteHash: string; orderId: string;
  provider: EconomicProvider; providerAccount: string; provenance: EconomicProvenance;
  captureReference: string; paymentReference: string; refundReference: string;
  currency: string; minorExponent: number; amountMinor: string; capturedMinor: string;
};
export type RefundProvider = {
  provider: EconomicProvider; providerAccount: string; provenance: EconomicProvenance;
  // No automatic retries. The dispatcher claims the operation before this call.
  create(expected: Omit<RefundExpectation, 'refundReference'>): Promise<string>;
  // Both resources MUST be retrieved on the configured account/mode.
  read(expected: RefundExpectation): Promise<{ refund: unknown; original: unknown }>;
};
function record(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Missing refund evidence');
  return raw as Record<string, unknown>;
}
function integer(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Unsafe provider amount');
  return BigInt(value);
}
export function refundReference(provider: EconomicProvider, value: string) {
  if (typeof value !== 'string' || !(provider === 'STRIPE' ? /^re_[A-Za-z0-9]{1,140}$/ : /^[A-Za-z0-9]{1,100}$/).test(value)) {
    throw new Error('Invalid refund reference');
  }
  return value;
}

/** Pure normalizer, not webhook signature verification. Trusted server reads
 * are mandatory; neither a browser response nor an admin reference is proof. */
export function verifyRefundEvidence(raw: { refund: unknown; original: unknown }, expected: RefundExpectation,
  scope: Pick<RefundProvider, 'provider' | 'providerAccount' | 'provenance'>) {
  if (scope.provider !== expected.provider || scope.providerAccount !== expected.providerAccount
    || scope.provenance !== expected.provenance || !scope.providerAccount || exactMinor(expected.amountMinor) <= 0n) {
    throw new Error('Refund provider account/mode mismatch');
  }
  refundReference(expected.provider, expected.refundReference);
  const refund = record(raw.refund), original = record(raw.original);
  if (refund['id'] !== expected.refundReference || original['id'] !== expected.captureReference) throw new Error('Foreign refund evidence');
  if (expected.provider === 'STRIPE') {
    const metadata = record(refund['metadata']);
    if (refund['status'] !== 'succeeded' || refund['charge'] !== expected.captureReference
      || refund['payment_intent'] !== expected.paymentReference || refund['currency'] !== expected.currency.toLowerCase()
      || integer(refund['amount']) !== exactMinor(expected.amountMinor)
      || original['payment_intent'] !== expected.paymentReference || original['livemode'] !== (expected.provenance === 'LIVE')
      || original['paid'] !== true || original['captured'] !== true || original['disputed'] !== false
      || original['currency'] !== expected.currency.toLowerCase() || integer(original['amount_captured']) !== exactMinor(expected.capturedMinor)
      || integer(original['amount_refunded']) < exactMinor(expected.amountMinor)
      || metadata['economicRefundOperationId'] !== expected.operationId || metadata['economicCaptureId'] !== expected.captureId
      || metadata['quoteHash'] !== expected.quoteHash) throw new Error('Stripe refund requires reconciliation');
  } else {
    const amount = record(refund['amount']), originalAmount = record(original['amount']);
    const payee = record(original['payee']), related = record(record(original['supplementary_data'])['related_ids']);
    const host = expected.provenance === 'LIVE' ? ['https://api-m.paypal.com', 'https://api.paypal.com'] : ['https://api-m.sandbox.paypal.com', 'https://api.sandbox.paypal.com'];
    const links = refund['links'];
    // Compare only. Never fetch a URL supplied by a provider payload.
    const bound = Array.isArray(links) && links.some(link => {
      const item = record(link);
      return item['rel'] === 'up' && item['method'] === 'GET'
        && host.some(origin => item['href'] === `${origin}/v2/payments/captures/${expected.captureReference}`);
    });
    if (refund['status'] !== 'COMPLETED' || refund['invoice_id'] !== expected.operationId || !bound
      || amount['currency_code'] !== expected.currency || typeof amount['value'] !== 'string'
      || parseMinorUnits(amount['value'], expected.minorExponent) !== exactMinor(expected.amountMinor)
      || !['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(original['status'] as string)
      || payee['merchant_id'] !== expected.providerAccount || related['order_id'] !== expected.paymentReference
      || original['custom_id'] !== expected.captureOperationId || original['invoice_id'] !== expected.quoteHash
      || originalAmount['currency_code'] !== expected.currency || typeof originalAmount['value'] !== 'string'
      || parseMinorUnits(originalAmount['value'], expected.minorExponent) !== exactMinor(expected.capturedMinor)) {
      throw new Error('PayPal refund requires reconciliation');
    }
  }
  return createHash('sha256').update(canonicalEconomicJson(expected)).digest('hex');
}
