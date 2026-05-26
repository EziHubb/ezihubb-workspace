import { Module } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { AdminShippingController } from './admin-shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  controllers: [ShippingController, AdminShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
