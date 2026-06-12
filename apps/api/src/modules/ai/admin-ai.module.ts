import { Module } from '@nestjs/common';
import { AdminAiController } from './admin-ai.controller';

@Module({
  controllers: [AdminAiController],
})
export class AdminAiModule {}
