import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import Stripe from 'stripe';
import { PaymentsService } from './payments.service';
import { StripeWebhookGuard } from '../../common/guards/stripe-webhook.guard';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('stripe')
  @UseGuards(StripeWebhookGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint — requires raw body and Stripe-Signature header' })
  async stripeWebhook(@Req() req: Request & { stripeEvent?: any }) {
    // stripeEvent is attached by StripeWebhookGuard after signature verification
    if (req.stripeEvent) {
      await this.paymentsService.handleStripeWebhook(req.stripeEvent);
    }
    return { received: true };
  }

  @Post('paypal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PayPal webhook endpoint (stub)' })
  async paypalWebhook() {
    // PayPal webhook verification and handling not yet implemented
    return { received: true };
  }
}
