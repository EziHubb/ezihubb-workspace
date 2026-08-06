import { Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { FulfillmentProviderType } from '@prisma/client';
import { FulfillmentWebhookGuard, FulfillmentWebhookRequest } from '../../common/guards/fulfillment-webhook.guard';
import { FulfillmentWebhookService } from './fulfillment-webhook.service';

@Controller('webhooks')
export class FulfillmentWebhookController {
  constructor(private readonly webhookService: FulfillmentWebhookService) {}

  // `:provider` is captured for readability only — the guard resolves the
  // connection purely from the opaque `:token`, so this single route serves
  // every provider (e.g. /webhooks/printify/:token, /webhooks/merchize/:token).
  @Post(':provider/:token')
  @UseGuards(FulfillmentWebhookGuard)
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: FulfillmentWebhookRequest): Promise<{ received: true }> {
    // req.body is already JSON-parsed by Nest's body parser; re-serializing is
    // wasteful but keeps the handler signatures provider-agnostic (they take a
    // raw Buffer, matching parseWebhookPayload on the interface).
    const rawBody = Buffer.from(JSON.stringify(req.body));

    if (req.fulfillmentConnection.provider === FulfillmentProviderType.MERCHIZE) {
      await this.webhookService.handleMerchizeEvent(req.fulfillmentConnection.id, rawBody);
    } else {
      await this.webhookService.handlePrintifyEvent(req.fulfillmentConnection.id, rawBody);
    }
    return { received: true };
  }
}
