import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { StorageService } from './services/storage.service';

/**
 * Global module — RedisService and StorageService are available
 * to every module in the application without additional imports.
 */
@Global()
@Module({
  providers: [RedisService, StorageService],
  exports: [RedisService, StorageService],
})
export class CommonModule {}
