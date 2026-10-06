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
import { EconomicAdminQueryDto, EconomicPayoutRejectDto, EconomicPayoutSettleDto } from './dto/economic-finances.dto';

@Controller('admin/economic-finances')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class AdminEconomicFinancesController {
  constructor(private readonly finances: EconomicFinancesService, private readonly contexts: StoreContextService) {}

  private async platform(req: Request) { this.contexts.requirePlatformContext(await this.contexts.resolve(req)); }
  private scope(query: EconomicAdminQueryDto) {
    return { kind: query.kind, beneficiaryId: query.beneficiaryId, currency: query.currency, provenance: query.provenance };
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
