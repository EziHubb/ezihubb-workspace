import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminReferralService } from './admin-referral.service';
import { ReferralPayoutStatus } from '@prisma/client';
import { Role } from '@ezihubb/constants';
import type {
  AdminBalanceAdjustDto,
  AdminTierOverrideDto,
  AdminPayoutRejectDto,
  AdminReferralSettingsDto,
  AdminTierDto,
} from './dto/referral.dto';

@ApiTags('admin-referrals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/referrals')
export class AdminReferralController {
  constructor(private readonly adminReferralService: AdminReferralService) {}

  @Get('overview')
  getOverview() {
    return this.adminReferralService.getOverview();
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  @Get('users')
  listUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('tierId') tierId?: string,
  ) {
    return this.adminReferralService.listUsers(+page, +limit, search, tierId);
  }

  @Get('users/:id/tree')
  getUserTree(@Param('id') id: string) {
    return this.adminReferralService.getUserTree(id);
  }

  @Patch('users/:id/balance')
  @HttpCode(HttpStatus.NO_CONTENT)
  adjustBalance(@Param('id') id: string, @Body() dto: AdminBalanceAdjustDto) {
    return this.adminReferralService.adjustBalance(id, dto);
  }

  @Patch('users/:id/tier')
  @HttpCode(HttpStatus.NO_CONTENT)
  overrideTier(@Param('id') id: string, @Body() dto: AdminTierOverrideDto) {
    return this.adminReferralService.overrideTier(id, dto.tierId);
  }

  // ── Payouts ────────────────────────────────────────────────────────────────

  @Get('payouts')
  listPayouts(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: ReferralPayoutStatus,
  ) {
    return this.adminReferralService.listPayouts(+page, +limit, status);
  }

  @Post('payouts/:id/pay')
  @HttpCode(HttpStatus.NO_CONTENT)
  markPayoutPaid(@Param('id') id: string, @Req() req: Request) {
    const adminId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.adminReferralService.markPayoutPaid(id, adminId);
  }

  @Post('payouts/:id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  rejectPayout(@Param('id') id: string, @Req() req: Request, @Body() dto: AdminPayoutRejectDto) {
    const adminId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.adminReferralService.rejectPayout(id, adminId, dto.reason);
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  @Get('settings')
  getSettings() {
    return this.adminReferralService.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: AdminReferralSettingsDto) {
    return this.adminReferralService.updateSettings(dto);
  }

  // ── Tiers ──────────────────────────────────────────────────────────────────

  @Get('tiers')
  getTiers() {
    return this.adminReferralService.getTiers();
  }

  @Post('tiers')
  createTier(@Body() dto: AdminTierDto) {
    return this.adminReferralService.createTier(dto);
  }

  @Patch('tiers/:id')
  updateTier(@Param('id') id: string, @Body() dto: Partial<AdminTierDto>) {
    return this.adminReferralService.updateTier(id, dto);
  }

  @Delete('tiers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTier(@Param('id') id: string) {
    return this.adminReferralService.deleteTier(id);
  }
}
