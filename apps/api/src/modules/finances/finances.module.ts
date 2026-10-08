import { Module } from '@nestjs/common';
import { FinancesController } from './finances.controller';
import { AdminFinancesController } from './admin-finances.controller';
import { FinancesService } from './finances.service';
import { EconomicFinancesService } from './economic-finances.service';
import { AdminEconomicFinancesController } from './admin-economic-finances.controller';
import { EconomicRefundsService } from './economic-refunds.service';
import { EconomicDispatcherService } from './economic-dispatcher.service';
import { EconomicRecoveryService } from './economic-recovery.service';
import { EconomicExternalEffectsService } from './economic-external-effects.service';

@Module({
  controllers: [FinancesController, AdminFinancesController, AdminEconomicFinancesController],
  providers:   [FinancesService, EconomicFinancesService, EconomicRefundsService, EconomicDispatcherService, EconomicRecoveryService, EconomicExternalEffectsService],
  exports: [EconomicFinancesService, EconomicRefundsService],
})
export class FinancesModule {}
