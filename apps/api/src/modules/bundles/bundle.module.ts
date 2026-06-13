import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BundleService } from './bundle.service';
import { BundleController } from './bundle.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BundleController],
  providers: [BundleService],
  exports: [BundleService],
})
export class BundleModule {}
