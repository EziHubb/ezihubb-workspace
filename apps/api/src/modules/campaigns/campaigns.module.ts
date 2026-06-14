import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';

@Module({
  imports:     [PrismaModule],
  controllers: [CampaignsController],
  providers:   [CampaignsService],
  exports:     [CampaignsService],
})
export class CampaignsModule {}
