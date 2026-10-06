import { createHash } from 'node:crypto';
import { EconomicProvider, EconomicProvenance } from '@prisma/client';
import { canonicalEconomicJson, exactMinor } from '../finances/economic-quote';
import { parseMinorUnits } from '../finances/economic-policy';

export type CaptureExpectation = {
  operationId: string; orderId: string; quoteHash: string; provider: EconomicProvider;
  providerAccount: string; provenance: EconomicProvenance; providerPaymentId: string;
  currency: string; minorExponent: number; amountMinor: string;
};
export type CaptureEvidence = CaptureExpectation & { providerReference: string; evidenceHash: string };
export type ProviderReadScope = { providerAccount: string; provenance: EconomicProvenance };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider evidence');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 150) throw new Error('Missing provider reference');
  return value;
}
function integer(value: unknown): bigint {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid provider amount');
  return BigInt(value);
}
function assertScope(expected: CaptureExpectation, scope: ProviderReadScope) {
  if (scope.providerAccount !== expected.providerAccount || scope.provenance !== expected.provenance
    || !scope.providerAccount || exactMinor(expected.amountMinor) <= 0n) throw new Error('Provider account/mode mismatch');
}
function evidence(expected: CaptureExpectation, providerReference: string): CaptureEvidence {
  // A minimal fingerprint, never provider PII/raw payload. The server-side reader
  // supplies expected binding; normalizers alone do NOT verify webhook signatures.
  const result = { ...expected, providerReference };
  return { ...result, evidenceHash: createHash('sha256').update(canonicalEconomicJson(result)).digest('hex') };
}

/** Input MUST be a server-retrieved PaymentIntent with expanded latest_charge. */
export function stripeCaptureEvidence(raw: unknown, expected: CaptureExpectation, scope: ProviderReadScope): CaptureEvidence {
  assertScope(expected, scope);
  const intent = record(raw);
  const charge = record(intent['latest_charge']);
  const metadata = record(intent['metadata']);
  const live = expected.provenance === 'LIVE';
  const amount = exactMinor(expected.amountMinor);
  if (expected.provider !== 'STRIPE' || intent['id'] !== expected.providerPaymentId
    || intent['status'] !== 'succeeded' || intent['livemode'] !== live || charge['livemode'] !== live
    || integer(intent['amount']) !== amount || integer(intent['amount_received']) !== amount
    || intent['currency'] !== expected.currency.toLowerCase()
    || charge['payment_intent'] !== intent['id'] || charge['paid'] !== true || charge['captured'] !== true
    || charge['status'] !== 'succeeded' || integer(charge['amount_captured']) !== amount
    || charge['currency'] !== intent['currency'] || integer(charge['amount_refunded']) !== 0n
    || charge['refunded'] !== false || charge['disputed'] !== false
    || metadata['orderId'] !== expected.orderId || metadata['economicOperationId'] !== expected.operationId
    || metadata['quoteHash'] !== expected.quoteHash) {
    throw new Error('Stripe capture requires reconciliation');
  }
  return evidence(expected, text(charge['id']));
}

/** Input MUST be GET /v2/payments/captures/:id on the configured account/mode. */
export function paypalCaptureEvidence(raw: unknown, expected: CaptureExpectation, scope: ProviderReadScope): CaptureEvidence {
  assertScope(expected, scope);
  const capture = record(raw);
  const amount = record(capture['amount']);
  const payee = record(capture['payee']);
  const related = record(record(capture['supplementary_data'])['related_ids']);
  if (expected.provider !== 'PAYPAL' || capture['status'] !== 'COMPLETED' || capture['final_capture'] !== true
    || payee['merchant_id'] !== expected.providerAccount || related['order_id'] !== expected.providerPaymentId
    || capture['custom_id'] !== expected.operationId || capture['invoice_id'] !== expected.quoteHash
    || amount['currency_code'] !== expected.currency
    || parseMinorUnits(text(amount['value']), expected.minorExponent) !== exactMinor(expected.amountMinor)) {
    throw new Error('PayPal capture requires reconciliation');
  }
  return evidence(expected, text(capture['id']));
}
