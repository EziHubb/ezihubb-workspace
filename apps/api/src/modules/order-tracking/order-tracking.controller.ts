import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

@Controller('webhooks')
export class PrintifyWebhookController {
  constructor(private readonly trackingService: OrderTrackingService) {}

  @Post('printify')
  handleWebhook(@Body() payload: any) {
    return this.trackingService.handlePrintifyWebhook(payload);
  }
}
