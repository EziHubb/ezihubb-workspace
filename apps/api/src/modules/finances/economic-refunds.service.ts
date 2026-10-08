import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EconomicProvider, EconomicProvenance } from '@prisma/client';
import axios from 'axios';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { RefundProvider } from '../payments/economic-refund-evidence';
import { economicEnabled, economicMode } from './economic-checkout';
import { economicTransaction, EconomicScope, minorDecimal, recoverEconomicDebt } from './economic-balance';
import { RefundSelection, ShippingOverrideInput } from './economic-refund-plan';
import { prepareQuantityRefund } from './economic-refund';
import { executeEconomicRefund } from './economic-refund-settlement';
import { EconomicQuote, exactMinor, quoteFingerprint } from './economic-quote';
import { EconomicRefundPlan } from './economic-refund-plan';
import { shippingRefundEligible } from './economic-shipping-refund';

const http = { timeout: 10_000, maxRedirects: 0 };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider response');
  return value as Record<string, unknown>;
}

@Injectable()
export class EconomicRefundsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  private enabled(provenance: EconomicProvenance) {
    if (!economicEnabled() || this.config.get<string>('ECONOMIC_REFUNDS_ENABLED') !== 'true') {
      throw new BadRequestException('Economic refund writes are not enabled');
    }
    if (economicMode() !== provenance) throw new BadRequestException('Economic refund activation mode mismatch');
  }
  writesEnabled(provenance: EconomicProvenance) {
    return economicEnabled() && this.config.get<string>('ECONOMIC_REFUNDS_ENABLED') === 'true'
      && process.env['ECONOMIC_V1_MODE'] === provenance;
  }

  async options(captureId: string, provenance: EconomicProvenance) {
    return this.prisma.$transaction(async tx => {
      const capture = await tx.economicCapture.findUniqueOrThrow({ where: { id: captureId }, include: { context: true } });
      if (capture.provenance !== provenance) throw new BadRequestException('Capture mode mismatch');
      const quote = capture.context.quote as unknown as EconomicQuote;
      if (quoteFingerprint(quote) !== capture.quoteHash) throw new BadRequestException('Capture quote mismatch');
      const requests = await tx.economicRefundRequest.findMany({ where: { captureId }, include: { operation: true, settlement: true } });
      const previous = new Map<string, number>();
      const shippingAmounts = new Map<string, bigint>();
      const shippingExceptions = new Set<string>();
      for (const request of requests.filter(row => row.operation.state === 'SUCCEEDED')) {
        if (!request.settlement) throw new BadRequestException('Refund history requires reconciliation');
        const plan = request.plan as unknown as EconomicRefundPlan;
        if (plan.quoteHash !== capture.quoteHash || !['refund-v1', 'shipping-override-v1'].includes(plan.version)) throw new BadRequestException('Refund history requires reconciliation');
        for (const part of plan.parts) {
          shippingAmounts.set(part.partKey, (shippingAmounts.get(part.partKey) ?? 0n) + exactMinor(part.customerMinor));
          if (plan.version === 'shipping-override-v1') shippingExceptions.add(part.partKey);
          else previous.set(part.partKey, (previous.get(part.partKey) ?? 0) + part.quantity);
        }
      }
      const unresolved = requests.find(row => !['SUCCEEDED', 'FAILED'].includes(row.operation.state));
      const shippingEligibility = new Map<string, boolean>();
      for (const part of quote.parts.filter(part => part.kind === 'SHIPPING')) {
        shippingEligibility.set(part.key, await shippingRefundEligible(tx, quote, part.storeOrderId));
      }
      return { version: 'economic-v1', captureId, provenance, currency: capture.currency,
        writesEnabled: this.writesEnabled(provenance),
        lines: quote.parts.map(part => ({ partKey: part.key, kind: part.kind,
          lineId: part.lineId, storeId: part.storeId, originalQuantity: part.quantity,
          remainingQuantity: part.quantity - (previous.get(part.key) ?? 0), customerMinor: part.customerMinor,
          ...(part.kind === 'SHIPPING' ? {
            remainingCustomerMinor: (exactMinor(part.customerMinor) - (shippingAmounts.get(part.key) ?? 0n)).toString(),
            shippingEligible: shippingEligibility.get(part.key) === true && !shippingExceptions.has(part.key),
          } : {}) })),
        unresolvedRequest: unresolved ? { id: unresolved.id, state: unresolved.operation.state,
          amountMinor: unresolved.operation.amountMinor.toString(), reason: unresolved.reason,
          giftWrapApproval: (unresolved.plan as unknown as EconomicRefundPlan).giftWrapApproval ?? null,
          shippingEligibility: (unresolved.plan as unknown as EconomicRefundPlan).shippingEligibility ?? null,
          shippingOverrideApproval: (unresolved.plan as unknown as EconomicRefundPlan).shippingOverrideApproval ?? null,
          providerReference: unresolved.operation.providerReference, requestedBy: unresolved.requestedBy } : null,
      };
    }, { isolationLevel: 'RepeatableRead' });
  }
  async prepare(captureId: string, actorId: string, provenance: EconomicProvenance, input: {
    reason: string; idempotencyKey: string; selection: RefundSelection[]; approveGiftWrap?: boolean;
  }) {
    this.enabled(provenance);
    const capture = await this.prisma.economicCapture.findUniqueOrThrow({ where: { id: captureId } });
    if (capture.provenance !== provenance) throw new BadRequestException('Capture mode mismatch');
    const request = await prepareQuantityRefund(this.prisma, { ...input, captureId, actorId });
    return { id: request.id, operationId: request.operationId, state: request.operation.state, amountMinor: request.operation.amountMinor.toString(),
      giftWrapApproval: (request.plan as unknown as EconomicRefundPlan).giftWrapApproval ?? null,
      shippingEligibility: (request.plan as unknown as EconomicRefundPlan).shippingEligibility ?? null };
  }
  async execute(id: string, actorId: string, provenance: EconomicProvenance, reference?: string) {
    this.enabled(provenance);
    const request = await this.prisma.economicRefundRequest.findUniqueOrThrow({ where: { id }, include: { capture: true } });
    if (request.capture.provenance !== provenance) throw new BadRequestException('Refund mode mismatch');
    return executeEconomicRefund(this.prisma, id, actorId, this.provider(request.capture), reference);
  }
  async prepareShippingOverride(captureId: string, actorId: string, provenance: EconomicProvenance,
    input: ShippingOverrideInput & { reason: string; idempotencyKey: string }) {
    this.enabled(provenance);
    const capture = await this.prisma.economicCapture.findUniqueOrThrow({ where: { id: captureId } });
    if (capture.provenance !== provenance) throw new BadRequestException('Capture mode mismatch');
    const { reason, idempotencyKey, ...shippingOverride } = input;
    const request = await prepareQuantityRefund(this.prisma, { captureId, actorId, reason, idempotencyKey, selection: [], shippingOverride });
    return { id: request.id, operationId: request.operationId, state: request.operation.state,
      amountMinor: request.operation.amountMinor.toString(),
      shippingOverrideApproval: (request.plan as unknown as EconomicRefundPlan).shippingOverrideApproval };
  }
  async recoverDebt(scope: EconomicScope, actorId: string) {
    this.enabled(scope.provenance);
    const recovered = await economicTransaction(this.prisma, tx => recoverEconomicDebt(tx, scope, actorId));
    return { ...scope, recoveredMinor: recovered.toString() };
  }

  /** A signed webhook supplies only a lookup hint. This method cannot dispatch:
   * execute requires a previously dispatched request and independently retrieves
   * the refund and original capture with server-controlled credentials. */
  async reconcileWebhook(contextId: string, provider: EconomicProvider, reference: string, operationHint?: string) {
    const request = await this.prisma.economicRefundRequest.findFirst({ where: {
      capture: { contextId, provider }, operation: { kind: 'REFUND', state: { in: ['DISPATCHED', 'NEEDS_RECONCILIATION', 'SUCCEEDED'] },
        ...(operationHint ? { id: operationHint } : { providerReference: reference }) },
    }, include: { capture: true } });
    if (!request) return false;
    await this.execute(request.id, 'provider-webhook', request.capture.provenance, reference);
    return true;
  }

  private provider(capture: { provider: EconomicProvider; providerAccount: string; provenance: EconomicProvenance }): RefundProvider {
    const common = { provider: capture.provider, providerAccount: capture.providerAccount, provenance: capture.provenance };
    if (capture.provider === 'STRIPE') {
      const key = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
      if (!key.startsWith(capture.provenance === 'LIVE' ? 'sk_live_' : 'sk_test_')
        || this.config.get<string>('ECONOMIC_STRIPE_ACCOUNT_ID') !== capture.providerAccount
        || !/^acct_[A-Za-z0-9]+$/.test(capture.providerAccount)) throw new BadRequestException('Stripe refund account/mode mismatch');
      const stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' as const, timeout: 10_000, maxNetworkRetries: 0 });
      const check = async () => { if ((await stripe.accounts.retrieve(null)).id !== capture.providerAccount) throw new Error('Stripe credential account mismatch'); };
      return { ...common, create: async expected => {
        if (!/^ch_[A-Za-z0-9]+$/.test(expected.captureReference) || expected.currency !== 'USD' || expected.minorExponent !== 2
          || BigInt(expected.amountMinor) > 99999999n) throw new Error('Unsupported Stripe refund amount/currency');
        await check();
        const original = await stripe.charges.retrieve(expected.captureReference);
        if (original.payment_intent !== expected.paymentReference || original.livemode !== (capture.provenance === 'LIVE')
          || original.currency !== expected.currency.toLowerCase() || !original.paid || !original.captured || original.disputed
          || !Number.isSafeInteger(original.amount_captured) || BigInt(original.amount_captured) !== BigInt(expected.capturedMinor)) {
          throw new Error('Stripe original capture binding mismatch');
        }
        return (await stripe.refunds.create({ charge: expected.captureReference, amount: Number(expected.amountMinor),
          metadata: { economicRefundOperationId: expected.operationId, economicCaptureId: expected.captureId, quoteHash: expected.quoteHash } },
        { idempotencyKey: expected.operationId, maxNetworkRetries: 0 })).id;
      }, read: async expected => {
        if (!/^ch_[A-Za-z0-9]+$/.test(expected.captureReference)) throw new Error('Invalid original Stripe charge');
        await check();
        const [refund, original] = await Promise.all([stripe.refunds.retrieve(expected.refundReference), stripe.charges.retrieve(expected.captureReference)]);
        return { refund, original };
      } };
    }
    const mode = capture.provenance === 'LIVE' ? 'live' : 'sandbox';
    const clientId = this.config.get<string>('PAYPAL_CLIENT_ID'), secret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    if (this.config.get<string>('PAYPAL_MODE') !== mode || this.config.get<string>('ECONOMIC_PAYPAL_MERCHANT_ID') !== capture.providerAccount
      || !clientId || !secret || !/^[A-Za-z0-9]{1,100}$/.test(capture.providerAccount)) throw new BadRequestException('PayPal refund account/mode mismatch');
    const origin = capture.provenance === 'LIVE' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    const headers = async () => {
      const response = await axios.post(`${origin}/v1/oauth2/token`, 'grant_type=client_credentials', {
        ...http, auth: { username: clientId, password: secret }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const token = object(response.data)['access_token'];
      if (typeof token !== 'string' || !token) throw new Error('PayPal authentication failed');
      return { Authorization: `Bearer ${token}` };
    };
    return { ...common, create: async expected => {
      if (!/^[A-Za-z0-9]{1,100}$/.test(expected.captureReference) || expected.currency !== 'USD' || expected.minorExponent !== 2) throw new Error('Unsupported PayPal refund binding');
      const auth = await headers();
      // Authenticate the original merchant binding before the irreversible POST.
      const original = object((await axios.get(`${origin}/v2/payments/captures/${expected.captureReference}`, { ...http, headers: auth })).data);
      if (object(original['payee'])['merchant_id'] !== capture.providerAccount || original['invoice_id'] !== expected.quoteHash
        || original['custom_id'] !== expected.captureOperationId) throw new Error('PayPal original capture binding mismatch');
      const response = await axios.post(`${origin}/v2/payments/captures/${expected.captureReference}/refund`, {
        amount: { currency_code: expected.currency, value: minorDecimal(BigInt(expected.amountMinor), expected.minorExponent) }, invoice_id: expected.operationId,
      }, { ...http, headers: { ...auth, 'PayPal-Request-Id': expected.operationId, Prefer: 'return=representation' } });
      const id = object(response.data)['id'];
      if (typeof id !== 'string') throw new Error('Missing PayPal refund identity');
      return id;
    }, read: async expected => {
      if (!/^[A-Za-z0-9]{1,100}$/.test(expected.captureReference)) throw new Error('Invalid original PayPal capture');
      const auth = await headers();
      const [refund, original] = await Promise.all([
        axios.get(`${origin}/v2/payments/refunds/${expected.refundReference}`, { ...http, headers: auth }),
        axios.get(`${origin}/v2/payments/captures/${expected.captureReference}`, { ...http, headers: auth }),
      ]);
      return { refund: refund.data, original: original.data };
    } };
  }
}
