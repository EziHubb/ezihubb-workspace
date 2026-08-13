import { Body, Delete, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';
import { FinancesService } from './finances.service';
import {
  UpdateBankAccountDto,
  ConfirmBillingCardDto,
  UpdateCurrencyDto,
  UpdateAutoBillingDto,
  UpdateTaxInfoDto,
  ActivitiesQueryDto,
} from './dto/finances.dto';

/**
 * Admin-app mirror of FinancesController (`/seller/finances/*`) — same
 * Etsy-parity Payment account / statements / settings / tax-info feature,
 * reused verbatim via FinancesService, but resolved through
 * StoreContextService instead of StoreOwnerGuard. This is what makes it work
 * for a SUPER_ADMIN in "My Store" mode (StoreOwnerGuard only ever resolves a
 * caller's own `ownedStore`, which a SUPER_ADMIN previewing another store
 * doesn't have) — matching every other admin-app shop-owner page (products,
 * orders, fulfillment, the old seller-payouts table), which all go through
 * StoreContextService for exactly this reason. A platform-context SUPER_ADMIN
 * with no store selected gets a clear 400, not a silent platform-wide view —
 * Finances has no multi-store aggregate concept.
 */
@AdminController('finances')
export class AdminFinancesController {
  constructor(
    private readonly financesService: FinancesService,
    private readonly storeContext:    StoreContextService,
  ) {}

  private async resolveStoreId(req: Request): Promise<string> {
    const context = await this.storeContext.resolve(req);
    return this.storeContext.requireStoreId(context);
  }

  @Get('overview')
  async getOverview(@Req() req: Request) {
    return this.financesService.getOverview(await this.resolveStoreId(req));
  }

  @Get('activity-summary')
  async getActivitySummary(
    @Req() req: Request,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.financesService.getActivitySummary(
      await this.resolveStoreId(req),
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
    );
  }

  @Get('activities')
  async getActivities(@Req() req: Request, @Query() query: ActivitiesQueryDto) {
    return this.financesService.getActivities(await this.resolveStoreId(req), query);
  }

  @Get('activities/export')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async exportActivities(
    @Req() req: Request,
    @Res() res: Response,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const storeId = await this.resolveStoreId(req);
    const csv = await this.financesService.exportActivitiesCsv(
      storeId,
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${storeId}-${Date.now()}.csv"`);
    res.send(csv);
  }

  // ── Bank account ─────────────────────────────────────────────────────────

  @Get('bank-account')
  async getBankAccount(@Req() req: Request) {
    return this.financesService.getBankAccount(await this.resolveStoreId(req));
  }

  @Patch('bank-account')
  async updateBankAccount(@Req() req: Request, @Body() dto: UpdateBankAccountDto) {
    return this.financesService.updateBankAccount(await this.resolveStoreId(req), dto);
  }

  // ── Billing cards ────────────────────────────────────────────────────────

  @Get('billing-cards')
  async listBillingCards(@Req() req: Request) {
    return this.financesService.listBillingCards(await this.resolveStoreId(req));
  }

  @Post('billing-cards/setup-intent')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async createSetupIntent(@Req() req: Request) {
    return this.financesService.createBillingCardSetupIntent(await this.resolveStoreId(req));
  }

  @Post('billing-cards/confirm')
  async confirmBillingCard(@Req() req: Request, @Body() dto: ConfirmBillingCardDto) {
    return this.financesService.confirmBillingCard(await this.resolveStoreId(req), dto.stripePaymentMethodId);
  }

  @Patch('billing-cards/:id/default')
  async setDefaultCard(@Req() req: Request, @Param('id') id: string) {
    return this.financesService.setDefaultBillingCard(await this.resolveStoreId(req), id);
  }

  @Delete('billing-cards/:id')
  async deleteCard(@Req() req: Request, @Param('id') id: string): Promise<void> {
    await this.financesService.deleteBillingCard(await this.resolveStoreId(req), id);
  }

  @Patch('auto-billing')
  async updateAutoBilling(@Req() req: Request, @Body() dto: UpdateAutoBillingDto) {
    return this.financesService.updateAutoBilling(await this.resolveStoreId(req), dto);
  }

  // ── Currency ─────────────────────────────────────────────────────────────

  @Patch('currency')
  async updateCurrency(@Req() req: Request, @Body() dto: UpdateCurrencyDto) {
    return this.financesService.updateCurrency(await this.resolveStoreId(req), dto);
  }

  // ── Legal and tax information ───────────────────────────────────────────

  @Get('tax-info')
  @ApiOperation({ summary: 'Legal and tax profile for the current store' })
  async getTaxInfo(@Req() req: Request) {
    return this.financesService.getTaxInfo(await this.resolveStoreId(req));
  }

  @Patch('tax-info')
  async updateTaxInfo(@Req() req: Request, @Body() dto: UpdateTaxInfoDto) {
    return this.financesService.updateTaxInfo(await this.resolveStoreId(req), dto);
  }
}
