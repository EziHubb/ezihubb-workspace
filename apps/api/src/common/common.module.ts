import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { StorageService } from './services/storage.service';
import { AuditLogService } from './services/audit-log.service';
import { EncryptionService } from './services/encryption.service';

/**
 * Global module — RedisService, StorageService, AuditLogService, and
 * EncryptionService are available to every module in the application
 * without additional imports.
 */
@Global()
@Module({
  providers: [RedisService, StorageService, AuditLogService, EncryptionService],
  exports: [RedisService, StorageService, AuditLogService, EncryptionService],
})
export class CommonModule {}
