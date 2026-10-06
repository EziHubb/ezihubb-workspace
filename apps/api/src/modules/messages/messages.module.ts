import { Module } from '@nestjs/common';
import { AdminMessagesController } from './admin-messages.controller';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { InboxService } from './inbox.service';
import { LinkPreviewService } from './link-preview.service';
import { SnippetsService } from './snippets.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModerationModule } from '../moderation/moderation.module';
import { BullModule } from '@nestjs/bullmq';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';
import { GuestMessageAccessService } from './guest-message-access.service';

@Module({
  imports: [NotificationsModule, ModerationModule,
    ...(process.env['DISABLE_QUEUE'] !== 'true' ? [BullModule.registerQueue({ name: QUEUES.EMAIL })] : [DevBullModule.forQueues([QUEUES.EMAIL])]),
  ],
  controllers: [MessagesController, AdminMessagesController],
  providers: [MessagesService, InboxService, SnippetsService, LinkPreviewService, GuestMessageAccessService],
  exports: [MessagesService, InboxService, SnippetsService, LinkPreviewService],
})
export class MessagesModule {}
