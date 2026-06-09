import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { AffiliatesController } from './affiliates.controller';
import { AdminAffiliatesController } from './admin-affiliates.controller';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { CommissionService } from './commission.service';
import { CommissionProcessor } from './commission.processor';
import { PortalService } from './portal.service';
import { AdminAffiliatesService } from './admin-affiliates.service';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ConfigModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.AFFILIATE_COMMISSION, QUEUES.EMAIL])]
      : [
          BullModule.registerQueue({ name: QUEUES.AFFILIATE_COMMISSION }),
          BullModule.registerQueue({ name: QUEUES.EMAIL }),
        ]),
  ],
  controllers: [AffiliatesController, AdminAffiliatesController],
  providers: [
    AffiliateTrackingService,
    CommissionService,
    PortalService,
    AdminAffiliatesService,
    ...(disableQueue ? [] : [CommissionProcessor]),
  ],
  exports: [AffiliateTrackingService, CommissionService],
})
export class AffiliatesModule {}
