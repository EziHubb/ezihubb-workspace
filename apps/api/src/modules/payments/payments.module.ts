import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
