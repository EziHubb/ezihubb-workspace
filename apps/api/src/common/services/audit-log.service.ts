import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditLogEntry {
  userId:     string;
  action:     string;
  entityType: string;
  entityId:   string;
  before?:    Record<string, unknown> | null;
  after?:     Record<string, unknown> | null;
  ip?:        string;
  userAgent?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget — never throws, never blocks the calling request. */
  log(entry: AuditLogEntry): void {
    this.prisma.auditLog
      .create({
        data: {
          userId:     entry.userId,
          action:     entry.action,
          entityType: entry.entityType,
          entityId:   entry.entityId,
          before:     (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
          after:      (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
          ip:         entry.ip,
          userAgent:  entry.userAgent,
        },
      })
      .catch((err: Error) => {
        this.logger.error(`Failed to write audit log: ${err.message}`);
      });
  }
}
