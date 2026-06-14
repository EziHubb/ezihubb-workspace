import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersController, WishlistPublicController } from './users.controller';
import { AdminCustomersController } from './admin-customers.controller';
import { UsersService } from './users.service';
import { ModerationModule } from '../moderation/moderation.module';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    ModerationModule,
  ],
  controllers: [UsersController, WishlistPublicController, AdminCustomersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
