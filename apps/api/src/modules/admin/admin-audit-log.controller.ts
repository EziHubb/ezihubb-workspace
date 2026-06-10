import { Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { paginatedResponse } from '../../common/dto/paginated-response.dto';

class AuditLogQueryDto {
  @IsOptional() @IsInt() @Min(1) @Transform(({ value }) => parseInt(String(value), 10))
  page?: number = 1;

  @IsOptional() @IsInt() @Min(1) @Max(100) @Transform(({ value }) => parseInt(String(value), 10))
  limit?: number = 50;

  @IsOptional() @IsString()
  userId?: string;

  @IsOptional() @IsString()
  entityType?: string;

  @IsOptional() @IsString()
  action?: string;
}

@AdminController('audit-logs')
export class AdminAuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Paginated audit log with optional filters' })
  @ApiQuery({ name: 'page',       required: false })
  @ApiQuery({ name: 'limit',      required: false })
  @ApiQuery({ name: 'userId',     required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'action',     required: false })
  async list(@Query() query: AuditLogQueryDto) {
    const page  = query.page  ?? 1;
    const limit = query.limit ?? 50;
    const skip  = (page - 1) * limit;

    const where = {
      ...(query.userId     ? { userId:     query.userId }     : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action     ? { action:     query.action }     : {}),
    };

    const [total, logs] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id:         true,
          userId:     true,
          action:     true,
          entityType: true,
          entityId:   true,
          ip:         true,
          createdAt:  true,
        },
      }),
    ]);

    return paginatedResponse(logs, total, page, limit);
  }

  @Get('entity-types')
  @ApiOperation({ summary: 'List distinct entityType values for filter dropdown' })
  async entityTypes() {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['entityType'],
      select:   { entityType: true },
      orderBy:  { entityType: 'asc' },
    });
    return rows.map((r) => r.entityType);
  }
}
