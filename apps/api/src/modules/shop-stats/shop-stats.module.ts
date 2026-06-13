import { Module } from '@nestjs/common';
import { ShopStatsController } from './shop-stats.controller';
import { ShopStatsService } from './shop-stats.service';

@Module({
  controllers: [ShopStatsController],
  providers:   [ShopStatsService],
  exports:     [ShopStatsService],
})
export class ShopStatsModule {}
