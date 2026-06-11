import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CreatorDnaService } from './creator-dna.service';
import { CreatorDnaController } from './creator-dna.controller';

@Module({
  imports:     [ConfigModule],
  controllers: [CreatorDnaController],
  providers:   [CreatorDnaService],
  exports:     [CreatorDnaService],
})
export class CreatorDnaModule {}
