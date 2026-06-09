import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoyaltyService } from './loyalty.service';
import { LOYALTY_CONFIG } from './loyalty.config';

@ApiTags('Loyalty')
@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user loyalty balance and transaction history' })
  getMyAccount(@CurrentUser() user: { id: string }) {
    return this.loyaltyService.getAccountSummary(user.id);
  }

  @Get('preview')
  @ApiOperation({ summary: 'Preview how much discount N points gives at checkout' })
  previewRedemption(@Query('points') pointsStr: string) {
    const points   = Math.max(0, parseInt(pointsStr ?? '0', 10));
    const valid    = points >= LOYALTY_CONFIG.MIN_REDEEM_POINTS;
    const discount = valid
      ? Math.round(points * LOYALTY_CONFIG.POINT_VALUE * 100) / 100
      : 0;
    return { valid, points, discount };
  }

  @Get('config')
  @ApiOperation({ summary: 'Get loyalty program configuration constants' })
  getConfig() {
    return {
      pointsPerDollar:    LOYALTY_CONFIG.POINTS_PER_DOLLAR,
      pointValue:         LOYALTY_CONFIG.POINT_VALUE,
      minRedeemPoints:    LOYALTY_CONFIG.MIN_REDEEM_POINTS,
      maxRedeemPercent:   LOYALTY_CONFIG.MAX_REDEEM_PERCENT,
      lockDays:           LOYALTY_CONFIG.LOCK_DAYS,
    };
  }
}
