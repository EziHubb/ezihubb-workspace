import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { StorageService } from './services/storage.service';
import { AuditLogService } from './services/audit-log.service';

/**
 * Global module — RedisService, StorageService, and AuditLogService are
 * available to every module in the application without additional imports.
 */
@Global()
@Module({
  providers: [RedisService, StorageService, AuditLogService],
  exports: [RedisService, StorageService, AuditLogService],
})
export class CommonModule {}
