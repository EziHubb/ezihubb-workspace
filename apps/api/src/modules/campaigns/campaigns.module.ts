import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CampaignsService } from './campaigns.service';
import { CampaignsController, CampaignsPublicController } from './campaigns.controller';

@Module({
  imports:     [PrismaModule],
  controllers: [CampaignsPublicController, CampaignsController],
  providers:   [CampaignsService],
  exports:     [CampaignsService],
})
export class CampaignsModule {}
