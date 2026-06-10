import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { PaypalService } from './paypal.service';
import { StripeWebhookGuard } from '../../common/guards/stripe-webhook.guard';

@ApiTags('Webhooks')
@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paypalService:   PaypalService,
  ) {}

  @Post('stripe')
  @UseGuards(StripeWebhookGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint — requires raw body and Stripe-Signature header' })
  async stripeWebhook(@Req() req: Request & { stripeEvent?: any }) {
    if (req.stripeEvent) {
      await this.paymentsService.handleStripeWebhook(req.stripeEvent);
    }
    return { received: true };
  }

  @Post('paypal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PayPal webhook — handles CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED/REFUNDED/DENIED' })
  async paypalWebhook(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const eventType = body['event_type'] as string | undefined;
    const resource  = body['resource']   as Record<string, unknown> | undefined;
    const eventId   = body['id']         as string | undefined;

    if (!eventType || !resource) {
      this.logger.warn('PayPal webhook: missing event_type or resource');
      return { received: true };
    }

    this.logger.log(`PayPal webhook: ${eventType} (id=${eventId})`);

    // Signature verification — dev-bypass when PAYPAL_WEBHOOK_ID is not set
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString('utf8')
      ?? JSON.stringify(body);
    const valid = await this.paypalService.verifyWebhookSignature(headers, rawBody);
    if (!valid) {
      this.logger.error(`PayPal webhook signature invalid for event ${eventId} — discarding`);
      return { received: true };
    }

    try {
      await this.paymentsService.handlePaypalWebhookEvent(eventType, resource, eventId ?? '');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`PayPal webhook handler error for ${eventType}: ${message}`);
      // Always return 200 to prevent PayPal from retrying processing errors
    }

    return { received: true };
  }
}
