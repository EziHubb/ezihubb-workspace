import { Module } from '@nestjs/common';
import { FinancesController } from './finances.controller';
import { AdminFinancesController } from './admin-finances.controller';
import { FinancesService } from './finances.service';
import { EconomicFinancesService } from './economic-finances.service';
import { AdminEconomicFinancesController } from './admin-economic-finances.controller';

@Module({
  controllers: [FinancesController, AdminFinancesController, AdminEconomicFinancesController],
  providers:   [FinancesService, EconomicFinancesService],
  exports: [EconomicFinancesService],
})
export class FinancesModule {}
