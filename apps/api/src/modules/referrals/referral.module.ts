import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReferralController } from './referral.controller';
import { CreatorController } from './creator.controller';
import { AdminReferralController } from './admin-referral.controller';
import { ReferralService } from './referral.service';
import { AdminReferralService } from './admin-referral.service';
import { ReferralProcessor } from './referral.processor';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.REFERRAL])]
      : [BullModule.registerQueue({ name: QUEUES.REFERRAL })]),
  ],
  controllers: [ReferralController, CreatorController, AdminReferralController],
  providers: [
    ReferralService,
    AdminReferralService,
    ...(disableQueue ? [] : [ReferralProcessor]),
  ],
  exports: [ReferralService],
})
export class ReferralModule {}
