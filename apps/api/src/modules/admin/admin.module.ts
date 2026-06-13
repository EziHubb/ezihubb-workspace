import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminEmailTemplatesController } from './admin-email-templates.controller';
import { AdminCacheController } from './admin-cache.controller';
import { AdminExportController } from './admin-export.controller';
import { AdminTeamController } from './admin-team.controller';
import { AdminAuditLogController } from './admin-audit-log.controller';
import { SettingsService } from './settings.service';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

@Module({
  imports: [
    ...(process.env['DISABLE_QUEUE'] !== 'true'
      ? [BullModule.registerQueue({ name: QUEUES.EMAIL })]
      : [DevBullModule.forQueues([QUEUES.EMAIL])]),
  ],
  controllers: [
    AdminController,
    AdminSettingsController,
    AdminEmailTemplatesController,
    AdminCacheController,
    AdminExportController,
    AdminTeamController,
    AdminAuditLogController,
  ],
  providers: [AdminService, SettingsService],
  exports: [AdminService, SettingsService],
})
export class AdminModule {}
