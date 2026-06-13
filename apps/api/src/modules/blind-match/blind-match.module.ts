import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';
import { BlindMatchService } from './blind-match.service';
import { BlindMatchController } from './blind-match.controller';
import { BlindMatchProcessor } from './blind-match.processor';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    PrismaModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.BLIND_MATCH])]
      : [BullModule.registerQueue({ name: QUEUES.BLIND_MATCH })]),
  ],
  controllers: [BlindMatchController],
  providers: [
    BlindMatchService,
    ...(disableQueue ? [] : [BlindMatchProcessor]),
  ],
  exports: [BlindMatchService],
})
export class BlindMatchModule {}
