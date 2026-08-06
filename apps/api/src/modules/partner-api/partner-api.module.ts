import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApiKeysService } from './api-keys.service';
import { AdminApiKeysController } from './admin-api-keys.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class PartnerApiModule {}
