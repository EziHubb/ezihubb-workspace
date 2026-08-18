import { Module } from '@nestjs/common';
import { MarketplaceInsightsController } from './marketplace-insights.controller';
import { MarketplaceInsightsService } from './marketplace-insights.service';
import { SearchModule } from '../search/search.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SearchModule, SubscriptionsModule],
  controllers: [MarketplaceInsightsController],
  providers: [MarketplaceInsightsService],
})
export class MarketplaceInsightsModule {}
