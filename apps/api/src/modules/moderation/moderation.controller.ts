import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { IPScanService } from './ip-scan.service';
import { IPScanDto } from './dto/ip-scan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class ModerationController {
  constructor(
    private readonly svc:        ModerationService,
    private readonly ipScanSvc:  IPScanService,
  ) {}

  @Get('queue')
  getQueue(@Query() q: { page?: string; limit?: string; severity?: string; entityType?: string }) {
    return this.svc.getQueue({
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 25,
      severity:   q.severity,
      entityType: q.entityType,
    });
  }

  // /flags is an alias for the queue used by the admin UI
  @Get('flags')
  getFlags(@Query() q: { page?: string; limit?: string; severity?: string; entityType?: string; status?: string; type?: string }) {
    return this.svc.getQueue({
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 25,
      severity:   q.severity,
      entityType: q.entityType ?? q.type,
    });
  }

  @Post('flags/:id/approve')
  approveFlag(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: { user: { sub: string } }) {
    return this.svc.adminApprove(id, req.user.sub, body.notes ?? '');
  }

  @Post('flags/:id/reject')
  rejectFlag(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: { user: { sub: string } }) {
    return this.svc.adminReject(id, req.user.sub, body.notes ?? '');
  }

  @Post('flags/:id/escalate')
  escalateFlag(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: { user: { sub: string } }) {
    // Escalation marks as needing senior review — treat as a special reject with escalation note
    return this.svc.adminReject(id, req.user.sub, `[ESCALATED] ${body.notes ?? ''}`);
  }

  @Get('logs')
  getLogs(@Query() q: { page?: string; limit?: string; verdict?: string; entityType?: string }) {
    return this.svc.getLogs({
      page: q.page ? Number(q.page) : 1,
      limit: q.limit ? Number(q.limit) : 25,
      verdict:    q.verdict,
      entityType: q.entityType,
    });
  }

  @Post('logs/:id/approve')
  approve(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: { user: { sub: string } }) {
    return this.svc.adminApprove(id, req.user.sub, body.notes ?? '');
  }

  @Post('logs/:id/reject')
  reject(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: { user: { sub: string } }) {
    return this.svc.adminReject(id, req.user.sub, body.notes ?? '');
  }

  @Post('recheck')
  recheck(@Body() body: { entityType: string; entityId: string }) {
    return this.svc.reCheckContent(body.entityType, body.entityId);
  }

  @Post('ip-scan')
  scanIP(@Body() dto: IPScanDto) {
    return this.ipScanSvc.scanDesignForIP(dto);
  }

  @Get('stats')
  stats() { return this.svc.getStats(); }

  @Get('settings')
  getSettings() { return this.svc.getSettings(); }

  @Patch('settings')
  updateSettings(@Body() body: Record<string, unknown>) { return this.svc.updateSettings(body); }

  @Get('rules')
  getRules() { return this.svc.getRules(); }

  @Post('rules')
  createRule(@Body() body: { name: string; description?: string; ruleType: string; value: string; severity: string; applyTo: string[] }, @Request() req: { user: { sub: string } }) {
    return this.svc.createRule({ ...body, createdBy: req.user.sub });
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() body: Partial<{ name: string; value: string; severity: string; isActive: boolean; applyTo: string[] }>) {
    return this.svc.updateRule(id, body);
  }

  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) { return this.svc.deleteRule(id); }
}

@Controller('admin/stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class StoreViolationsController {
  constructor(private readonly svc: ModerationService) {}

  @Get(':id/violations')
  getViolations(@Param('id') id: string) { return this.svc.getStoreViolations(id); }

  @Post(':id/clear-strikes')
  clearStrikes(@Param('id') id: string) { return this.svc.clearStrikes(id); }
}
