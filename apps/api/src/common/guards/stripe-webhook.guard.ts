import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';

@Injectable()
export class StripeWebhookGuard implements CanActivate {
  private readonly logger = new Logger(StripeWebhookGuard.name);
  private readonly stripe: any;
  private readonly webhookSecret: string;
  private readonly isProd: boolean;

  constructor(private readonly config: ConfigService) {
    const secretKey = config.get<string>('STRIPE_SECRET_KEY') ?? '';
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
    this.isProd = config.get<string>('NODE_ENV') === 'production';
    this.stripe = new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' as const });
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { stripeEvent?: any }>();
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      throw new UnauthorizedException({
        code: 'ERR_UNAUTHORIZED',
        message: 'Missing Stripe-Signature header.',
      });
    }

    if (!this.webhookSecret) {
      if (this.isProd) {
        throw new InternalServerErrorException({
          code: 'ERR_MISCONFIGURED',
          message: 'STRIPE_WEBHOOK_SECRET is not configured.',
        });
      }
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification (non-production only)');
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
