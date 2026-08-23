import { Module } from '@nestjs/common';
import { AdminMessagesController } from './admin-messages.controller';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { InboxService } from './inbox.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [NotificationsModule, ModerationModule],
  controllers: [MessagesController, AdminMessagesController],
  providers: [MessagesService, InboxService],
  exports: [MessagesService, InboxService],
})
export class MessagesModule {}
