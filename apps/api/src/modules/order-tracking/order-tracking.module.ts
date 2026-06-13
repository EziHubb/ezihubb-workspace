import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrderTrackingService } from './order-tracking.service';
import { OrderTrackingController, PrintifyWebhookController } from './order-tracking.controller';

@Module({
  imports: [PrismaModule],
  controllers: [OrderTrackingController, PrintifyWebhookController],
  providers: [OrderTrackingService],
  exports: [OrderTrackingService],
})
export class OrderTrackingModule {}
