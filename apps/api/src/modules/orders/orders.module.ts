import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { ShippingModule } from '../shipping/shipping.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TaxModule } from '../tax/tax.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { PdfModule } from '../pdf/pdf.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ReferralModule } from '../referrals/referral.module';
import { StoreCreditsModule } from '../store-credits/store-credits.module';

@Module({
  imports: [ShippingModule, PaymentsModule, NotificationsModule, TaxModule, AffiliatesModule, PdfModule, LoyaltyModule, ReferralModule, StoreCreditsModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
