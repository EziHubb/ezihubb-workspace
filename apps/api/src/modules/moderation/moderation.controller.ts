import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ModerationService } from './moderation.service';
import { IPScanService } from './ip-scan.service';
import { IPScanDto } from './dto/ip-scan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { AuditLogService } from '../../common/services/audit-log.service';
import { StoreContextService } from '../../common/services/store-context.service';

type ModerationRequest = { user: { sub: string }; ip: string; headers: { 'user-agent'?: string } };

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class ModerationController {
  constructor(
    private readonly svc:        ModerationService,
    private readonly ipScanSvc:  IPScanService,
    private readonly auditLog:   AuditLogService,
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
  async approveFlag(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: ModerationRequest) {
    const result = await this.svc.adminApprove(id, req.user.sub, body.notes ?? '');
    this.logModerationDecision(req, id, 'APPROVE', body.notes);
    return result;
  }

  @Post('flags/:id/reject')
  async rejectFlag(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: ModerationRequest) {
    const result = await this.svc.adminReject(id, req.user.sub, body.notes ?? '');
    this.logModerationDecision(req, id, 'REJECT', body.notes);
    return result;
  }

  @Post('flags/:id/escalate')
  async escalateFlag(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: ModerationRequest) {
    // Escalation marks as needing senior review — treat as a special reject with escalation note
    const result = await this.svc.adminReject(id, req.user.sub, `[ESCALATED] ${body.notes ?? ''}`);
    this.logModerationDecision(req, id, 'ESCALATE', body.notes);
    return result;
  }

  private logModerationDecision(req: ModerationRequest, entityId: string, action: string, notes?: string): void {
    this.auditLog.log({
      userId:     req.user.sub,
      action,
      entityType: 'ModerationFlag',
      entityId,
      after:      notes ? { notes } : undefined,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
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
  async approve(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: ModerationRequest) {
    const result = await this.svc.adminApprove(id, req.user.sub, body.notes ?? '');
    this.logModerationDecision(req, id, 'APPROVE', body.notes);
    return result;
  }

  @Post('logs/:id/reject')
  async reject(@Param('id') id: string, @Body() body: { notes?: string }, @Request() req: ModerationRequest) {
    const result = await this.svc.adminReject(id, req.user.sub, body.notes ?? '');
    this.logModerationDecision(req, id, 'REJECT', body.notes);
    return result;
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
export class StoreViolationsController {
  constructor(
    private readonly svc:          ModerationService,
    private readonly auditLog:     AuditLogService,
    private readonly storeContext: StoreContextService,
  ) {}

  // Seller-facing — always scoped to the caller's OWN store, resolved
  // server-side rather than trusting a client-supplied id. The :id/violations
  // route below takes an arbitrary path param and previously allowed
  // Role.ADMIN (shop owner) to pass ANY store's id — an IDOR letting one
  // seller read/clear another seller's violation record. Fixed by moving
  // self-service access here and restricting the id-based routes to
  // SUPER_ADMIN (platform moderator acting on an arbitrary store) only.
  @Get('me/violations')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getMyViolations(@Request() req: ExpressRequest) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.svc.getStoreViolations(storeId);
  }

  @Get(':id/violations')
  @Roles(Role.SUPER_ADMIN)
  getViolations(@Param('id') id: string) { return this.svc.getStoreViolations(id); }

  @Post(':id/clear-strikes')
  @Roles(Role.SUPER_ADMIN)
  async clearStrikes(@Param('id') id: string, @Request() req: ModerationRequest) {
    const result = await this.svc.clearStrikes(id);
    this.auditLog.log({
      userId:     req.user.sub,
      action:     'CLEAR_STRIKES',
      entityType: 'Store',
      entityId:   id,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
    return result;
  }
}
