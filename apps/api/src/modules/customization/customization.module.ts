import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DevBullModule } from '../../queue/dev-bull.module';
import { CustomizationController } from './customization.controller';
import { CustomizationService } from './customization.service';
import { ArtStyleService } from './art-style.service';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [...(process.env['DISABLE_QUEUE'] !== 'true'
      ? [BullModule.registerQueue({ name: QUEUES.IMAGE_PROCESSING })]
      : [DevBullModule.forQueues([QUEUES.IMAGE_PROCESSING])])],
  controllers: [CustomizationController],
  providers: [CustomizationService, ArtStyleService],
  exports: [CustomizationService, ArtStyleService],
})
export class CustomizationModule {}
