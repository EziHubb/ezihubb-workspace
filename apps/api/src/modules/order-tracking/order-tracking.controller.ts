import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrderTrackingService } from './order-tracking.service';

@Controller('orders')
export class OrderTrackingController {
  constructor(private readonly trackingService: OrderTrackingService) {}

  @UseGuards(JwtAuthGuard)
  @Get(':orderId/tracking')
  getTracking(@Param('orderId') orderId: string) {
    return this.trackingService.getTracking(orderId);
  }
}

// Printify webhook handling moved to apps/api/src/modules/fulfillment/
// (fulfillment-webhook.controller.ts) — the old POST /webhooks/printify route
// here had no auth and a broken correlation lookup (matched Printify's
// external_id against OrderTracking.orderId, which never matches an internal
// cuid), so it's been replaced entirely rather than kept as a dead route.
