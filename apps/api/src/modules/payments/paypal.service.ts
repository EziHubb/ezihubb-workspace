import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

const PAYPAL_TOKEN_CACHE_KEY = 'paypal:access_token';

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly webhookId: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {
    const mode = config.get<string>('PAYPAL_MODE') ?? 'sandbox';
    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
    this.clientId     = config.get<string>('PAYPAL_CLIENT_ID')     ?? '';
    this.clientSecret = config.get<string>('PAYPAL_CLIENT_SECRET') ?? '';
    this.webhookId    = config.get<string>('PAYPAL_WEBHOOK_ID')    ?? '';
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  private async getAccessToken(): Promise<string> {
    const client = this.redis.getClient();

    const cached = await client.get(PAYPAL_TOKEN_CACHE_KEY);
    if (cached) return cached;

    const response = await axios.post<{ access_token: string; expires_in: number }>(
      `${this.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: this.clientId, password: this.clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const token     = response.data.access_token;
    const expiresIn = response.data.expires_in ?? 32400; // 9 h default

    await client.set(PAYPAL_TOKEN_CACHE_KEY, token, 'EX', Math.floor(expiresIn * 0.9));
    return token;
  }

  /**
   * Creates a PayPal order for the given MLH order ID.
   * Returns the PayPal order ID and the payer approval URL.
   */
  async createOrder(
    orderId: string,
    returnUrl?: string,
    cancelUrl?: string,
  ): Promise<{ paypalOrderId: string; approvalUrl: string }> {
    if (!this.isConfigured()) {
      throw new BadRequestException({
        code:    'ERR_PAYPAL_NOT_CONFIGURED',
        message: 'PayPal is not configured on this server',
      });
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException({ code: 'ERR_NOT_FOUND', message: 'Order not found' });

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException({
        code:    'ERR_ORDER_INVALID_STATE',
        message: 'Order is not awaiting payment',
      });
    }

    const token  = await this.getAccessToken();
    const amount = Number(order.total).toFixed(2);

    const response = await axios.post<{ id: string; links: { rel: string; href: string }[] }>(
      `${this.baseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: orderId,
            amount: { currency_code: 'USD', value: amount },
            description: `MapleLoom Handmade order #${order.orderNumber}`,
          },
        ],
        application_context: {
          ...(returnUrl ? { return_url: returnUrl } : {}),
          ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
          brand_name:          'MapleLoom Handmade',
          user_action:         'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      },
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const paypalOrderId = response.data.id;
    const approvalUrl   =
      response.data.links.find((l) => l.rel === 'approve')?.href ?? '';

    await this.prisma.payment.upsert({
      where:  { orderId },
      create: {
        orderId,
        method:       PaymentMethod.PAYPAL,
        status:       PaymentStatus.PENDING,
        amount:       order.total,
        currency:     'usd',
        paypalOrderId,
      },
      update: {
        paypalOrderId,
        method: PaymentMethod.PAYPAL,
        status: PaymentStatus.PENDING,
      },
    });

    this.logger.log(`PayPal order created: ${paypalOrderId} for order ${orderId}`);
    return { paypalOrderId, approvalUrl };
  }

  /**
   * Captures a PayPal order after the payer approves it.
   * Idempotent — returns immediately if already captured.
   */
  async captureOrder(paypalOrderId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new BadRequestException({
        code:    'ERR_PAYPAL_NOT_CONFIGURED',
        message: 'PayPal is not configured on this server',
      });
    }

    const payment = await this.prisma.payment.findFirst({
      where:   { paypalOrderId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException({
        code:    'ERR_NOT_FOUND',
        message: 'No pending payment found for this PayPal order',
      });
    }

    if (payment.status === PaymentStatus.PAID) return; // Already captured — idempotent

    const token = await this.getAccessToken();

    const response = await axios.post<{
      status: string;
      purchase_units: { payments: { captures: { id: string }[] } }[];
    }>(
      `${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
      {},
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.data.status !== 'COMPLETED') {
      throw new BadRequestException({
        code:    'ERR_PAYPAL_CAPTURE_FAILED',
        message: `PayPal capture returned status: ${response.data.status}`,
      });
    }

    const captureId =
      response.data.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? '';
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data:  {
          status:         PaymentStatus.PAID,
          paidAt:         now,
          paypalCaptureId: captureId,
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data:  { status: OrderStatus.CONFIRMED, confirmedAt: now },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: payment.orderId,
          status:  OrderStatus.CONFIRMED,
          note:    'PayPal payment captured',
        },
      });

      if (payment.order.userId) {
        await tx.cart.updateMany({
          where: { userId: payment.order.userId },
          data:  { couponCode: null, discountAmount: null },
        });
        await tx.cartItem.deleteMany({
          where: { cart: { userId: payment.order.userId } },
        });
      }
    });

    this.logger.log(`PayPal captured: ${captureId} for order ${payment.orderId}`);
  }

  /**
   * Verifies the PayPal webhook signature via the PayPal API.
   * Returns true (bypass) when PAYPAL_WEBHOOK_ID is not set (dev/sandbox with ngrok).
   */
  async verifyWebhookSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<boolean> {
    if (!this.webhookId) {
      this.logger.warn('PAYPAL_WEBHOOK_ID not set — skipping webhook signature verification');
      return true;
    }

    if (!this.isConfigured()) return false;

    try {
      const token = await this.getAccessToken();
      const response = await axios.post<{ verification_status: string }>(
        `${this.baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          auth_algo:         headers['paypal-auth-algo'],
          cert_url:          headers['paypal-cert-url'],
          transmission_id:   headers['paypal-transmission-id'],
          transmission_sig:  headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id:        this.webhookId,
          webhook_event:     JSON.parse(rawBody),
        },
        {
          headers: {
            Authorization:  `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data.verification_status === 'SUCCESS';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`PayPal webhook signature verification failed: ${message}`);
      return false;
    }
  }
}
