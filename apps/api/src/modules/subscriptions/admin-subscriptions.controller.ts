import { Body, Get, Param, Post, Patch, Req } from '@nestjs/common';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { SubscriptionsService } from './subscriptions.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { GrantSubscriptionDto, ExtendSubscriptionDto, RevokeSubscriptionDto } from './dto/subscription.dto';

// Class-level override fully replaces @AdminController's default
// ADMIN+SUPER_ADMIN — every route here is SUPER_ADMIN only. A shop owner
// can never grant/extend/revoke their own Plus, by construction.
//
// @Roles MUST be listed BEFORE @AdminController in source. Decorators on the
// same declaration apply bottom-to-top, so the one closer to the class runs
// LAST and wins when both set the same 'roles' metadata key.
// @AdminController(...) internally calls Roles(Role.ADMIN, Role.SUPER_ADMIN)
// itself — with the order reversed (as this file originally had it), that
// internal call ran after this one and silently overwrote it back to
// ADMIN+SUPER_ADMIN, verified via Reflect.getMetadata. Caught by
// admin-subscriptions.controller.spec.ts, which exercises the real
// RolesGuard against this class's real metadata rather than assuming the
// decorator worked.
@Roles(Role.SUPER_ADMIN)
@AdminController('stores')
export class AdminSubscriptionsController {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly auditLog: AuditLogService,
  ) {}

  private actor(req: any): string {
    return req.user?.sub ?? req.user?.id ?? '';
  }

  @Get(':id/subscription')
  async getSubscription(@Param('id') id: string) {
    return this.subscriptions.getForStore(id);
  }

  @Post(':id/subscription/grant')
  async grant(@Param('id') id: string, @Req() req: any, @Body() dto: GrantSubscriptionDto) {
    const before = await this.subscriptions.getForStore(id);
    const after = await this.subscriptions.grant(id, dto.cycle, this.actor(req));
    this.auditLog.log({
      userId: this.actor(req), action: 'GRANT_PLUS', entityType: 'StoreSubscription', entityId: after.id,
      before, after, ip: req.ip, userAgent: req.headers?.['user-agent'],
    });
    return after;
  }

  @Patch(':id/subscription/extend')
  async extend(@Param('id') id: string, @Req() req: any, @Body() dto: ExtendSubscriptionDto) {
    const before = await this.subscriptions.getForStore(id);
    const after = await this.subscriptions.extend(id, dto.months, this.actor(req));
    this.auditLog.log({
      userId: this.actor(req), action: 'EXTEND_PLUS', entityType: 'StoreSubscription', entityId: after.id,
      before, after, ip: req.ip, userAgent: req.headers?.['user-agent'],
    });
    return after;
  }

  @Post(':id/subscription/cancel-renewal')
  async cancelRenewal(@Param('id') id: string, @Req() req: any) {
    // Internal-only in Phase 1 — no seller-facing route calls this yet (see
    // SubscriptionsService.cancelRenewal doc comment). SUPER_ADMIN can still
    // use it directly, e.g. on a seller's request via support.
    const before = await this.subscriptions.getForStore(id);
    const after = await this.subscriptions.cancelRenewal(id, this.actor(req));
    this.auditLog.log({
      userId: this.actor(req), action: 'CANCEL_RENEWAL_PLUS', entityType: 'StoreSubscription', entityId: after.id,
      before, after, ip: req.ip, userAgent: req.headers?.['user-agent'],
    });
    return after;
  }

  @Post(':id/subscription/revoke')
  async revoke(@Param('id') id: string, @Req() req: any, @Body() dto: RevokeSubscriptionDto) {
    const before = await this.subscriptions.getForStore(id);
    const after = await this.subscriptions.revokeImmediately(id);
    this.auditLog.log({
      userId: this.actor(req), action: 'REVOKE_PLUS', entityType: 'StoreSubscription', entityId: after.id,
      before, after: { ...after, revokeReason: dto.reason ?? null },
      ip: req.ip, userAgent: req.headers?.['user-agent'],
    });
    return after;
  }
}
