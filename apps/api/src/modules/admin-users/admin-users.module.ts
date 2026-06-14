import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [AdminUsersController],
})
export class AdminUsersModule {}
