import { Module } from '@nestjs/common';
import { AdminMessagesController } from './admin-messages.controller';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { InboxService } from './inbox.service';
import { LinkPreviewService } from './link-preview.service';
import { SnippetsService } from './snippets.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [NotificationsModule, ModerationModule],
  controllers: [MessagesController, AdminMessagesController],
  providers: [MessagesService, InboxService, SnippetsService, LinkPreviewService],
  exports: [MessagesService, InboxService, SnippetsService, LinkPreviewService],
})
export class MessagesModule {}
