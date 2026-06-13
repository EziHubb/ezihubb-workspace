import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { QUEUES } from '../../queue/queue.constants';
import { FlashDealService } from './flash-deal.service';
import { FlashDealController, AdminFlashDealController } from './flash-deal.controller';
import { FlashDealProcessor } from './flash-deal.processor';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    BullModule.registerQueue({ name: QUEUES.FLASH_DEALS }),
  ],
  controllers: [FlashDealController, AdminFlashDealController],
  providers: [FlashDealService, FlashDealProcessor],
  exports: [FlashDealService],
})
export class FlashDealModule {}
