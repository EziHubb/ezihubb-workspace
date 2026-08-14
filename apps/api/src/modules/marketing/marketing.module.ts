import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MarketingController } from './marketing.controller';
import { BuyerOffersController } from './buyer-offers.controller';
import { BuyerOffersService } from './buyer-offers.service';
import { LinkAttributionService } from './link-attribution.service';
import { ShareSaveService } from './share-save.service';
import { OffsiteAdsService } from './offsite-ads.service';
import { TargetedOffersService } from './targeted-offers.service';
import { SocialService } from './social.service';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.EMAIL])]
      : [BullModule.registerQueue({ name: QUEUES.EMAIL })]),
  ],
  controllers: [MarketingController, BuyerOffersController],
  providers: [LinkAttributionService, ShareSaveService, OffsiteAdsService, TargetedOffersService, SocialService, BuyerOffersService],
  exports: [LinkAttributionService, TargetedOffersService],
})
export class MarketingModule {}
