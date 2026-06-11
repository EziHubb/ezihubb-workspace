import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CanvaService } from './canva.service';
import { CanvaController } from './canva.controller';

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [CanvaController],
  providers:   [CanvaService],
  exports:     [CanvaService],
})
export class CanvaModule {}
