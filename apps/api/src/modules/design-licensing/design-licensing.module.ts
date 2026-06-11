import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DesignLicensingService } from './design-licensing.service';
import { DesignLicensingController } from './design-licensing.controller';

@Module({
  imports:     [ConfigModule],
  controllers: [DesignLicensingController],
  providers:   [DesignLicensingService],
  exports:     [DesignLicensingService],
})
export class DesignLicensingModule {}
