import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { VipService } from './vip.service';
import { VipController } from './vip.controller';

@Module({
  imports: [PrismaModule],
  controllers: [VipController],
  providers: [VipService],
  exports: [VipService],
})
export class VipModule {}
