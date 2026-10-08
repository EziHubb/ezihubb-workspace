import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@ezihubb/constants';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StoreContextService } from '../../common/services/store-context.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { EconomicFinancesService } from './economic-finances.service';
import { EconomicAdminQueryDto, EconomicBalanceQueryDto, EconomicExternalEffectsQueryDto, EconomicHistoryQueryDto, EconomicLifecycleRecoveryDto, EconomicPayoutRejectDto, EconomicPayoutSettleDto, EconomicReconciliationQueryDto, EconomicRefundExecuteDto, EconomicRefundPrepareDto, EconomicShippingRefundOverrideDto } from './dto/economic-finances.dto';
import { EconomicRefundsService } from './economic-refunds.service';
import { EconomicRecoveryService } from './economic-recovery.service';
import { EconomicExternalEffectsService } from './economic-external-effects.service';

@Controller('admin/economic-finances')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminEconomicFinancesController {
  constructor(private readonly finances: EconomicFinancesService, private readonly contexts: StoreContextService,
    private readonly refunds: EconomicRefundsService, private readonly recovery: EconomicRecoveryService,
    private readonly external: EconomicExternalEffectsService) {}

  private async platform(req: Request) { this.contexts.requirePlatformContext(await this.contexts.resolve(req)); }
  private scope(query: EconomicAdminQueryDto) {
    return { kind: query.kind, beneficiaryId: query.beneficiaryId, currency: query.currency, provenance: query.provenance };
  }
  @Get('external-effects')
  async externalEffects(@Req() req: Request, @Query() query: EconomicExternalEffectsQueryDto) {
    await this.platform(req); return this.external.list(query);
  }
  @Post('store-orders/:id/pod-intents')
  async preparePod(@Req() req: Request, @CurrentUser() user: JwtPayload, @Param('id') id: string,
    @Query() query: EconomicBalanceQueryDto, @Body() dto: EconomicLifecycleRecoveryDto) {
    await this.platform(req); return this.external.preparePod(id, user.sub, query.provenance, dto.reason);
  }
  @Post('external-effects/:id/execute-pod')
  async executePod(@Req() req: Request, @Param('id') id: string, @Query() query: EconomicBalanceQueryDto,
    @Body() dto: EconomicRefundExecuteDto) {
    await this.platform(req); return this.external.executePod(id, query.provenance, dto.reference);
  }
  @Get('lifecycle-recovery')
  async recoveryHistory(@Req() req: Request, @Query() query: EconomicHistoryQueryDto) {
    await this.platform(req);
    return this.recovery.list(query);
  }
  @Post('outbox/:id/recover-lifecycle')
  async recoverLifecycle(@Req() req: Request, @CurrentUser() user: JwtPayload, @Param('id') id: string,
    @Query() query: EconomicBalanceQueryDto, @Body() dto: EconomicLifecycleRecoveryDto) {
    await this.platform(req);
    return this.recovery.recover(id, user.sub, query.provenance, dto.reason);
  }

  @Post('captures/:id/refund-requests')
  async prepareRefund(@Req() req: Request, @CurrentUser() user: JwtPayload, @Param('id') id: string,
    @Query() query: EconomicBalanceQueryDto, @Body() dto: EconomicRefundPrepareDto) {
    await this.platform(req);
    return this.refunds.prepare(id, user.sub, query.provenance, dto);
  }

  @Get('captures/:id/refund-options')
  async refundOptions(@Req() req: Request, @Param('id') id: string, @Query() query: EconomicBalanceQueryDto) {
    await this.platform(req);
    return this.refunds.options(id, query.provenance);
  }

  @Post('captures/:id/shipping-refund-override')
  async prepareShippingOverride(@Req() req: Request, @CurrentUser() user: JwtPayload, @Param('id') id: string,
    @Query() query: EconomicBalanceQueryDto, @Body() dto: EconomicShippingRefundOverrideDto) {
    await this.platform(req);
    return this.refunds.prepareShippingOverride(id, user.sub, query.provenance, dto);
  }

  @Post('refund-requests/:id/execute')
  async executeRefund(@Req() req: Request, @CurrentUser() user: JwtPayload, @Param('id') id: string,
    @Query() query: EconomicBalanceQueryDto, @Body() dto: EconomicRefundExecuteDto) {
    await this.platform(req);
    return this.refunds.execute(id, user.sub, query.provenance, dto.reference);
  }

  @Post('debt/recover')
  async recoverDebt(@Req() req: Request, @CurrentUser() user: JwtPayload, @Query() query: EconomicAdminQueryDto) {
    await this.platform(req);
    return this.refunds.recoverDebt(this.scope(query), user.sub);
  }

  @Get('reconciliation')
  async reconciliation(@Req() req: Request, @Query() query: EconomicReconciliationQueryDto) {
    await this.platform(req);
    return this.finances.reconciliation(query);
  }

  @Get('summary')
  async summary(@Req() req: Request, @Query() query: EconomicBalanceQueryDto) {
    await this.platform(req);
    return this.finances.summary({ currency: query.currency, provenance: query.provenance });
  }

  @Get('overview')
  async overview(@Req() req: Request, @Query() query: EconomicAdminQueryDto) {
    await this.platform(req);
    return this.finances.overview(this.scope(query));
  }

  @Get('statement')
  async statement(@Req() req: Request, @Query() query: EconomicAdminQueryDto) {
    await this.platform(req);
    return this.finances.statement(this.scope(query), query, query.orderId);
  }

  @Get('payouts')
  async payouts(@Req() req: Request, @Query() query: EconomicAdminQueryDto) {
    await this.platform(req);
    return this.finances.payouts(this.scope(query), query);
  }

  @Post('payouts/:id/reject')
  async reject(@Req() req: Request, @CurrentUser() user: JwtPayload, @Param('id') id: string,
    @Query() query: EconomicAdminQueryDto, @Body() dto: EconomicPayoutRejectDto) {
    await this.platform(req);
    return this.finances.reject(id, user.sub, dto.reason, this.scope(query));
  }

  @Post('payouts/:id/verify-settlement')
  async settle(@Req() req: Request, @CurrentUser() user: JwtPayload, @Param('id') id: string,
    @Query() query: EconomicAdminQueryDto, @Body() dto: EconomicPayoutSettleDto) {
    await this.platform(req);
    return this.finances.settle(id, user.sub, dto.reference, this.scope(query));
  }
}
