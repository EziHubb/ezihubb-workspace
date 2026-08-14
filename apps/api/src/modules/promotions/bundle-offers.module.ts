import { Module } from '@nestjs/common';
import { BundleOffersController } from './bundle-offers.controller';
import { BundleOffersService } from './bundle-offers.service';

@Module({
  controllers: [BundleOffersController],
  providers: [BundleOffersService],
  exports: [BundleOffersService],
})
export class BundleOffersModule {}
