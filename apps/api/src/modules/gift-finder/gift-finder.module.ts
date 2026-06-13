import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { GiftFinderService } from './gift-finder.service';
import { GiftFinderController } from './gift-finder.controller';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [GiftFinderController],
  providers: [GiftFinderService],
  exports: [GiftFinderService],
})
export class GiftFinderModule {}
