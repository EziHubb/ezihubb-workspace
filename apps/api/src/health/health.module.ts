import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [HealthController],
})
export class HealthModule {}
