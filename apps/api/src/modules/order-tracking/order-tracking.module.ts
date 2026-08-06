import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrderTrackingService } from './order-tracking.service';
import { OrderTrackingController } from './order-tracking.controller';

@Module({
  imports: [PrismaModule],
  controllers: [OrderTrackingController],
  providers: [OrderTrackingService],
  exports: [OrderTrackingService],
})
export class OrderTrackingModule {}
