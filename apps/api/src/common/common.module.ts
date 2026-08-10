import { Global, Module } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { StorageService } from './services/storage.service';
import { AuditLogService } from './services/audit-log.service';
import { EncryptionService } from './services/encryption.service';
import { StoreContextService } from './services/store-context.service';

/**
 * Global module — RedisService, StorageService, AuditLogService,
 * EncryptionService, and StoreContextService are available to every module
 * in the application without additional imports.
 */
@Global()
@Module({
  providers: [RedisService, StorageService, AuditLogService, EncryptionService, StoreContextService],
  exports: [RedisService, StorageService, AuditLogService, EncryptionService, StoreContextService],
})
export class CommonModule {}
