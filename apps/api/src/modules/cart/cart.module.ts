import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { ShippingModule } from '../shipping/shipping.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [ShippingModule, AnalyticsModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
