import { Module } from '@nestjs/common';
import { AdminMessagesController } from './admin-messages.controller';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [MessagesController, AdminMessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
