import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';

@Injectable()
export class StripeWebhookGuard implements CanActivate {
  private readonly logger = new Logger(StripeWebhookGuard.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(private readonly config: ConfigService) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { stripeEvent?: Stripe.Event }>();
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      throw new UnauthorizedException({
        code: 'ERR_UNAUTHORIZED',
        message: 'Missing Stripe-Signature header.',
      });
    }

    if (!this.webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      return true;
    }

    try {
      // NestJS rawBody:true stores the raw Buffer at req.rawBody (req.body is parsed JSON)
      const rawBody = (req as unknown as { rawBody: Buffer }).rawBody;
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
      req.stripeEvent = event;
      return true;
    } catch (err) {
      this.logger.error(`Stripe webhook signature verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException({
        code: 'ERR_UNAUTHORIZED',
        message: 'Stripe webhook signature verification failed.',
      });
    }
  }
}
