import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EntitlementsService } from './entitlements.service';
import { SubscriptionsService } from './subscriptions.service';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { SellerSubscriptionController } from './seller-subscription.controller';

@Module({
  imports:     [PrismaModule],
  controllers: [AdminSubscriptionsController, SellerSubscriptionController],
  providers:   [EntitlementsService, SubscriptionsService],
  exports:     [EntitlementsService, SubscriptionsService],
})
export class SubscriptionsModule {}
