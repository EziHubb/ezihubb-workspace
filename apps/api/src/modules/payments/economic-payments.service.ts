import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EconomicProvenance } from '@prisma/client';
import axios from 'axios';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { minorDecimal } from '../finances/economic-balance';
import { verifyAndBookEconomicCapture } from '../finances/economic-capture';
import { requireEconomicCheckout } from '../finances/economic-checkout';
import { claimEconomicOperation, markEconomicOperationAmbiguous } from '../finances/economic-durability';
import { createEconomicPayment, PaymentCreationBinding } from './economic-payment-intent';
import { paypalEconomicCaptureReader, stripeEconomicCaptureReader } from './economic-capture-readers';

const readOptions = { timeout: 10_000, maxNetworkRetries: 0 };
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider response');
  return value as Record<string, unknown>;
}

export function verifyStripeCreatedPayment(raw: unknown, binding: PaymentCreationBinding) {
  const intent = record(raw), metadata = record(intent['metadata']);
  if (typeof intent['id'] !== 'string' || !/^pi_[A-Za-z0-9]+$/.test(intent['id'])
    || intent['livemode'] !== (binding.provenance === 'LIVE') || !Number.isSafeInteger(intent['amount'])
    || BigInt(intent['amount'] as number).toString() !== binding.amountMinor || intent['currency'] !== binding.currency.toLowerCase()
    || metadata['orderId'] !== binding.orderId || metadata['economicOperationId'] !== binding.operationId
    || metadata['quoteHash'] !== binding.quoteHash || typeof intent['client_secret'] !== 'string'
    || intent['status'] === 'canceled') throw new Error('Stripe payment creation requires reconciliation');
  return { id: intent['id'], clientSecret: intent['client_secret'] };
}

export function verifyPaypalCreatedPayment(raw: unknown, binding: PaymentCreationBinding) {
  const order = record(raw);
  const units = order['purchase_units'];
  if (!Array.isArray(units) || units.length !== 1) throw new Error('PayPal purchase units mismatch');
  const unit = record(units[0]), amount = record(unit['amount']), payee = record(unit['payee']);
  if (typeof order['id'] !== 'string' || !/^[A-Za-z0-9]{1,100}$/.test(order['id']) || order['intent'] !== 'CAPTURE'
    || !['CREATED', 'SAVED', 'APPROVED', 'PAYER_ACTION_REQUIRED', 'COMPLETED'].includes(String(order['status']))
    || unit['reference_id'] !== binding.orderId || unit['custom_id'] !== binding.operationId || unit['invoice_id'] !== binding.quoteHash
    || payee['merchant_id'] !== binding.providerAccount || amount['currency_code'] !== binding.currency
    || amount['value'] !== minorDecimal(BigInt(binding.amountMinor), binding.minorExponent)) throw new Error('PayPal order creation requires reconciliation');
  const links = Array.isArray(order['links']) ? order['links'].map(record) : [];
  const approve = links.find(link => link['rel'] === 'approve' || link['rel'] === 'payer-action')?.['href'];
  if (approve !== undefined) {
    const parsed = new URL(String(approve));
    const host = binding.provenance === 'LIVE' ? 'www.paypal.com' : 'www.sandbox.paypal.com';
    if (parsed.protocol !== 'https:' || parsed.hostname !== host || parsed.username || parsed.password || parsed.port) throw new Error('Untrusted PayPal approval URL');
  }
  return { id: order['id'], approvalUrl: typeof approve === 'string' ? approve : '' };
}

/** Versioned producer/callback adapter. No payout, refund, fulfillment or legacy event publishing. */
@Injectable()
export class EconomicPaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  hasContext(orderId: string) { return this.prisma.economicOrderContext.findUnique({ where: { orderId } }); }

  private stripeScope(mode: EconomicProvenance) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY') ?? '';
    const account = this.config.get<string>('ECONOMIC_STRIPE_ACCOUNT_ID') ?? '';
    if (!key.startsWith(mode === 'LIVE' ? 'sk_live_' : 'sk_test_') || !/^acct_[A-Za-z0-9]+$/.test(account)) {
      throw new BadRequestException('Stripe economic account/mode is not configured');
    }
    return { account, stripe: new Stripe(key, { apiVersion: '2026-04-22.dahlia' as const, ...readOptions }) };
  }

  private paypalScope(mode: EconomicProvenance) {
    const configured = this.config.get<string>('PAYPAL_MODE');
    const merchant = this.config.get<string>('ECONOMIC_PAYPAL_MERCHANT_ID') ?? '';
    const clientId = this.config.get<string>('PAYPAL_CLIENT_ID') ?? '';
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET') ?? '';
    if (configured !== (mode === 'LIVE' ? 'live' : 'sandbox') || !/^[A-Za-z0-9]{1,100}$/.test(merchant) || !clientId || !clientSecret) {
      throw new BadRequestException('PayPal economic account/mode is not configured');
    }
    const origin = mode === 'LIVE' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    // No global token cache: tokens from a different account/environment must never leak into this scope.
    const accessToken = async () => {
      const response = await axios.post(`${origin}/v1/oauth2/token`, 'grant_type=client_credentials', {
        auth: { username: clientId, password: clientSecret }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000, maxRedirects: 0,
      });
      if (typeof response.data?.access_token !== 'string' || !response.data.access_token) throw new Error('PayPal authentication failed');
      return response.data.access_token as string;
    };
    return { merchant, origin, accessToken };
  }

  async createStripe(orderId: string, giftCardCode?: string) {
    requireEconomicCheckout(giftCardCode);
    const context = await this.prisma.economicOrderContext.findUniqueOrThrow({ where: { orderId } });
    const { stripe, account } = this.stripeScope(context.provenance);
    const checkAccount = async () => {
      if ((await stripe.accounts.retrieve(null, {}, readOptions)).id !== account) throw new Error('Stripe credential account mismatch');
    };
    const created = await createEconomicPayment(this.prisma, orderId, {
      provider: 'STRIPE', providerAccount: account, provenance: context.provenance,
      create: async binding => {
        if (binding.currency !== 'USD' || binding.minorExponent !== 2 || BigInt(binding.amountMinor) < 50n || BigInt(binding.amountMinor) > 99999999n) {
          throw new BadRequestException('Amount is outside the supported Stripe checkout range');
        }
        await checkAccount();
        const intent = await stripe.paymentIntents.create({ amount: Number(binding.amountMinor), currency: binding.currency.toLowerCase(),
          metadata: { orderId, economicOperationId: binding.operationId, quoteHash: binding.quoteHash } },
        { ...readOptions, idempotencyKey: binding.createOperationId });
        return verifyStripeCreatedPayment(intent, binding);
      },
      read: async (id, binding) => {
        await checkAccount();
        const intent = await stripe.paymentIntents.retrieve(id, {}, readOptions);
        if (intent.id !== id) throw new Error('Stripe lookup mismatch');
        return verifyStripeCreatedPayment(intent, binding);
      },
    });
    const payment = await this.prisma.payment.findUniqueOrThrow({ where: { orderId } });
    if (!created.clientSecret) throw new Error('Stripe client secret is unavailable');
    return { clientSecret: created.clientSecret, amount: Number(payment.amount), currency: context.currency.toLowerCase() };
  }

  async createPaypal(orderId: string) {
    requireEconomicCheckout();
    const context = await this.prisma.economicOrderContext.findUniqueOrThrow({ where: { orderId } });
    const { merchant, origin, accessToken } = this.paypalScope(context.provenance);
    const read = async (id: string, binding: PaymentCreationBinding) => {
      if (!/^[A-Za-z0-9]{1,100}$/.test(id)) throw new Error('Invalid PayPal order identity');
      const response = await axios.get(`${origin}/v2/checkout/orders/${id}`, {
        headers: { Authorization: `Bearer ${await accessToken()}` }, timeout: 10_000, maxRedirects: 0,
      });
      if (response.data?.id !== id) throw new Error('PayPal lookup mismatch');
      return verifyPaypalCreatedPayment(response.data, binding);
    };
    const created = await createEconomicPayment(this.prisma, orderId, {
      provider: 'PAYPAL', providerAccount: merchant, provenance: context.provenance, read,
      create: async binding => {
        const response = await axios.post(`${origin}/v2/checkout/orders`, {
          intent: 'CAPTURE', purchase_units: [{ reference_id: orderId, custom_id: binding.operationId, invoice_id: binding.quoteHash,
            payee: { merchant_id: merchant }, amount: { currency_code: binding.currency, value: minorDecimal(BigInt(binding.amountMinor), binding.minorExponent) } }],
          application_context: { brand_name: 'EziHubb', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' },
        }, { headers: { Authorization: `Bearer ${await accessToken()}`, 'PayPal-Request-Id': binding.createOperationId, Prefer: 'return=representation' }, timeout: 10_000, maxRedirects: 0 });
        return verifyPaypalCreatedPayment(response.data, binding);
      },
    });
    return { paypalOrderId: created.id, approvalUrl: created.approvalUrl ?? '' };
  }

  async capturePaypal(paypalOrderId: string) {
    const payment = await this.prisma.payment.findFirstOrThrow({ where: { paypalOrderId } });
    const context = await this.prisma.economicOrderContext.findUniqueOrThrow({ where: { orderId: payment.orderId } });
    const op = await this.prisma.economicOperation.findFirstOrThrow({ where: { contextId: context.id, kind: 'CAPTURE', provider: 'PAYPAL' } });
    const { merchant, origin, accessToken } = this.paypalScope(context.provenance);
    if (op.providerAccount !== merchant || !/^[A-Za-z0-9]{1,100}$/.test(paypalOrderId)) throw new Error('PayPal capture binding mismatch');
    const token = await claimEconomicOperation(this.prisma, op.id);
    try {
      const headers = { Authorization: `Bearer ${await accessToken()}`, 'PayPal-Request-Id': op.id };
      // Retry of an already dispatched capture ONLY reads evidence, never POSTs again.
      const response = token
        ? await axios.post(`${origin}/v2/checkout/orders/${paypalOrderId}/capture`, {}, { headers, timeout: 10_000, maxRedirects: 0 })
        : await axios.get(`${origin}/v2/checkout/orders/${paypalOrderId}`, { headers, timeout: 10_000, maxRedirects: 0 });
      if (response.data?.id !== paypalOrderId) throw new Error('PayPal order lookup mismatch');
      const captures = response.data?.purchase_units?.flatMap((unit: { payments?: { captures?: Array<{ id?: string }> } }) => unit.payments?.captures ?? []);
      if (!Array.isArray(captures) || captures.length !== 1 || typeof captures[0]?.id !== 'string') throw new ConflictException('PayPal capture awaits reconciliation');
      return await verifyAndBookEconomicCapture(this.prisma, op.id, paypalEconomicCaptureReader({ merchantId: merchant,
        provenance: context.provenance, captureId: captures[0].id, accessToken }));
    } catch (error) {
      if (token) await markEconomicOperationAmbiguous(this.prisma, op.id, token);
      throw error;
    }
  }

  async stripeWebhook(type: string, object: Record<string, unknown>): Promise<boolean> {
    const paymentId = type.startsWith('payment_intent.') ? object['id'] : object['payment_intent'];
    if (typeof paymentId !== 'string') return false;
    const payment = await this.prisma.payment.findFirst({ where: { stripePaymentIntentId: paymentId } });
    if (!payment) {
      const metadata = object['metadata'] as { economicOperationId?: unknown } | undefined;
      const hint = metadata?.economicOperationId;
      if (typeof hint === 'string' && await this.prisma.economicOperation.findUnique({ where: { id: hint } })) {
        throw new ConflictException('Provider payment exists before local binding; reconciliation required');
      }
      return false;
    }
    const context = await this.hasContext(payment.orderId);
    if (!context) return false;
    if (type === 'payment_intent.succeeded') {
      const op = await this.prisma.economicOperation.findFirstOrThrow({ where: { contextId: context.id, kind: 'CAPTURE', provider: 'STRIPE' } });
      const { stripe, account } = this.stripeScope(context.provenance);
      await verifyAndBookEconomicCapture(this.prisma, op.id, stripeEconomicCaptureReader(stripe, account, context.provenance));
    } else if (type === 'charge.refunded' || type.startsWith('charge.dispute.')) {
      await this.holdForReconciliation(context.id);
    }
    // Do not mark a recoverable failed attempt terminal or fall into the legacy event chain.
    return true;
  }

  async paypalWebhook(type: string, object: Record<string, unknown>): Promise<boolean> {
    const related = object['supplementary_data'] as { related_ids?: { order_id?: string } } | undefined;
    const paypalOrderId = type.startsWith('CHECKOUT.ORDER.') ? object['id'] : related?.related_ids?.order_id;
    const links = Array.isArray(object['links']) ? object['links'].map(record) : [];
    const parentCapture = links.find(link => link['rel'] === 'up')?.['href'];
    // A refund resource id is NOT its capture id. Only extract an identifier; never fetch this URL.
    const captureId = type === 'PAYMENT.CAPTURE.REFUNDED' && typeof parentCapture === 'string'
      ? parentCapture.match(/\/v2\/payments\/captures\/([A-Za-z0-9]+)$/)?.[1]
      : type.startsWith('PAYMENT.CAPTURE.') ? object['id'] : undefined;
    const clauses = [typeof paypalOrderId === 'string' ? { paypalOrderId } : null,
      typeof captureId === 'string' ? { paypalCaptureId: captureId } : null].filter(row => row !== null);
    const payment = clauses.length ? await this.prisma.payment.findFirst({ where: { OR: clauses } }) : null;
    if (!payment) {
      // A provider can finish before the local create/bind transaction commits.
      // custom_id is only a routing hint: never use it as capture proof, but do
      // not acknowledge a known v1 operation through the legacy no-op handler.
      const units = Array.isArray(object['purchase_units']) ? object['purchase_units'].map(record) : [];
      const hints = [object['custom_id'], ...units.map(unit => unit['custom_id'])]
        .filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 150);
      if (hints.length && await this.prisma.economicOperation.findFirst({ where: {
        id: { in: hints }, provider: 'PAYPAL', kind: 'CAPTURE',
      } })) throw new ConflictException('Provider payment exists before local binding; reconciliation required');
      return false;
    }
    const context = await this.hasContext(payment.orderId);
    if (!context) return false;
    if (type === 'PAYMENT.CAPTURE.COMPLETED') {
      const op = await this.prisma.economicOperation.findFirstOrThrow({ where: { contextId: context.id, kind: 'CAPTURE', provider: 'PAYPAL' } });
      const { merchant, accessToken } = this.paypalScope(context.provenance);
      if (typeof captureId !== 'string') throw new Error('Missing PayPal capture lookup');
      await verifyAndBookEconomicCapture(this.prisma, op.id, paypalEconomicCaptureReader({ merchantId: merchant, provenance: context.provenance, captureId, accessToken }));
    } else if (type === 'PAYMENT.CAPTURE.REFUNDED' || type === 'PAYMENT.CAPTURE.REVERSED') {
      await this.holdForReconciliation(context.id);
    }
    return true;
  }

  private async holdForReconciliation(contextId: string) {
    // A signed external refund/reversal notification cannot become available funds
    // while M4 original-allocation reconciliation is pending. No guessed refund amount.
    await this.prisma.economicBalanceLot.updateMany({ where: { capture: { contextId }, holdReason: null },
      data: { holdReason: 'Provider adjustment requires original-allocation reconciliation' } });
    throw new ConflictException('Provider adjustment awaits economic reconciliation');
  }
}
