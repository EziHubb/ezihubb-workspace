import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreOwnerGuard } from '../stores/guards/store-owner.guard';
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
 * Etsy-parity seller Finances module (Payment account / Monthly statements /
 * Payment settings / Legal and tax information). Seller-only by design — a
 * platform-context SUPER_ADMIN has no legitimate reason to view or edit any
 * store's bank account, billing card, or tax profile, so this uses
 * StoreOwnerGuard (same as SellerOrdersController/SellerPayoutsController)
 * rather than StoreContextService's platform-wide escape hatch.
 */
@ApiTags('Seller - Finances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, StoreOwnerGuard)
@Controller('seller/finances')
export class FinancesController {
  constructor(private readonly financesService: FinancesService) {}

  @Get('overview')
  getOverview(@Req() req: any) {
    return this.financesService.getOverview(req.store.id);
  }

  @Get('activity-summary')
  getActivitySummary(
    @Req() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.financesService.getActivitySummary(
      req.store.id,
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
    );
  }

  @Get('activities')
  getActivities(@Req() req: any, @Query() query: ActivitiesQueryDto) {
    return this.financesService.getActivities(req.store.id, query);
  }

  @Get('activities/export')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async exportActivities(
    @Req() req: any,
    @Res() res: Response,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const csv = await this.financesService.exportActivitiesCsv(
      req.store.id,
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="statement-${req.store.slug}-${Date.now()}.csv"`);
    res.send(csv);
  }

  // ── Bank account ─────────────────────────────────────────────────────────

  @Get('bank-account')
  getBankAccount(@Req() req: any) {
    return this.financesService.getBankAccount(req.store.id);
  }

  @Patch('bank-account')
  updateBankAccount(@Req() req: any, @Body() dto: UpdateBankAccountDto) {
    return this.financesService.updateBankAccount(req.store.id, dto);
  }

  // ── Billing cards ────────────────────────────────────────────────────────

  @Get('billing-cards')
  listBillingCards(@Req() req: any) {
    return this.financesService.listBillingCards(req.store.id);
  }

  @Post('billing-cards/setup-intent')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  createSetupIntent(@Req() req: any) {
    return this.financesService.createBillingCardSetupIntent(req.store.id);
  }

  @Post('billing-cards/confirm')
  confirmBillingCard(@Req() req: any, @Body() dto: ConfirmBillingCardDto) {
    return this.financesService.confirmBillingCard(req.store.id, dto.stripePaymentMethodId);
  }

  @Patch('billing-cards/:id/default')
  setDefaultCard(@Req() req: any, @Param('id') id: string) {
    return this.financesService.setDefaultBillingCard(req.store.id, id);
  }

  @Delete('billing-cards/:id')
  async deleteCard(@Req() req: any, @Param('id') id: string): Promise<void> {
    await this.financesService.deleteBillingCard(req.store.id, id);
  }

  @Patch('auto-billing')
  updateAutoBilling(@Req() req: any, @Body() dto: UpdateAutoBillingDto) {
    return this.financesService.updateAutoBilling(req.store.id, dto);
  }

  // ── Currency ─────────────────────────────────────────────────────────────

  @Patch('currency')
  updateCurrency(@Req() req: any, @Body() dto: UpdateCurrencyDto) {
    return this.financesService.updateCurrency(req.store.id, dto);
  }

  // ── Legal and tax information ───────────────────────────────────────────

  @Get('tax-info')
  getTaxInfo(@Req() req: any) {
    return this.financesService.getTaxInfo(req.store.id);
  }

  @Patch('tax-info')
  updateTaxInfo(@Req() req: any, @Body() dto: UpdateTaxInfoDto) {
    return this.financesService.updateTaxInfo(req.store.id, dto);
  }
}
