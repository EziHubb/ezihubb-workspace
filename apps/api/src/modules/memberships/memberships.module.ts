import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { MembershipsService } from './memberships.service';
import { MembershipsController } from './memberships.controller';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ConfigModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.EMAIL])]
      : [BullModule.registerQueue({ name: QUEUES.EMAIL })]),
  ],
  controllers: [MembershipsController],
  providers:   [MembershipsService],
  exports:     [MembershipsService],
})
export class MembershipsModule {}
