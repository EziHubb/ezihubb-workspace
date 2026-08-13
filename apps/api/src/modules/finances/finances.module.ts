import { Module } from '@nestjs/common';
import { FinancesController } from './finances.controller';
import { AdminFinancesController } from './admin-finances.controller';
import { FinancesService } from './finances.service';

@Module({
  controllers: [FinancesController, AdminFinancesController],
  providers:   [FinancesService],
})
export class FinancesModule {}
