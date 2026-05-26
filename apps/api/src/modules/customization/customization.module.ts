import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CustomizationController } from './customization.controller';
import { CustomizationService } from './customization.service';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.IMAGE_PROCESSING })],
  controllers: [CustomizationController],
  providers: [CustomizationService],
  exports: [CustomizationService],
})
export class CustomizationModule {}
