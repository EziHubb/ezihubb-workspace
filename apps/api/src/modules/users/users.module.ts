import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersController, WishlistPublicController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [UsersController, WishlistPublicController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
