import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrderTrackingModule } from '../order-tracking/order-tracking.module';
import { PrintifyProvider } from './printify/printify.provider';
import { FulfillmentRegistryService } from './fulfillment-registry.service';
import { FulfillmentConnectionsService } from './fulfillment-connections.service';
import { FulfillmentWebhookService } from './fulfillment-webhook.service';
import { FulfillmentWebhookController } from './fulfillment-webhook.controller';
import { AdminFulfillmentController } from './admin-fulfillment.controller';
import { FULFILLMENT_PROVIDERS } from './interfaces/fulfillment-provider.interface';

@Module({
  imports: [PrismaModule, OrderTrackingModule],
  controllers: [FulfillmentWebhookController, AdminFulfillmentController],
  providers: [
    PrintifyProvider,
    {
      provide:    FULFILLMENT_PROVIDERS,
      useFactory: (printify: PrintifyProvider) => [printify],
      inject:     [PrintifyProvider],
    },
    FulfillmentRegistryService,
    FulfillmentConnectionsService,
    FulfillmentWebhookService,
  ],
  exports: [FulfillmentRegistryService, FulfillmentConnectionsService],
})
export class FulfillmentModule {}
