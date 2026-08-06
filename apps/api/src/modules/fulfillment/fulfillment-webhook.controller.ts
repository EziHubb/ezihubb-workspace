import { Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { PrintifyWebhookGuard, PrintifyWebhookRequest } from '../../common/guards/printify-webhook.guard';
import { FulfillmentWebhookService } from './fulfillment-webhook.service';

@Controller('webhooks/printify')
export class FulfillmentWebhookController {
  constructor(private readonly webhookService: FulfillmentWebhookService) {}

  @Post(':token')
  @UseGuards(PrintifyWebhookGuard)
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: PrintifyWebhookRequest): Promise<{ received: true }> {
    // req.body is already JSON-parsed by Nest's body parser; re-serializing is
    // wasteful but keeps handlePrintifyEvent's signature provider-agnostic
    // (it takes a raw Buffer, matching parseWebhookPayload on the interface).
    await this.webhookService.handlePrintifyEvent(
      req.fulfillmentConnection.id,
      Buffer.from(JSON.stringify(req.body)),
    );
    return { received: true };
  }
}
