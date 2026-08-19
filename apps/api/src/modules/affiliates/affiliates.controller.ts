import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { PortalService } from './portal.service';
import { TrackClickDto } from './dto/track-click.dto';
import { ApplyAffiliateDto } from './dto/apply-affiliate.dto';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Affiliates')
// Class-level guard: the five me/* routes below read @CurrentUser() and had
// no guard at all, so req.user was undefined and each one 500'd on user.sub
// — the whole affiliate portal, payout requests included. The four public
// routes carry @Public(), which JwtAuthGuard honours.
@UseGuards(JwtAuthGuard)
@Controller('affiliates')
export class AffiliatesController {
  constructor(
    private readonly trackingService: AffiliateTrackingService,
    private readonly portalService:   PortalService,
  ) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  // GET /api/v1/affiliates/settings/public
  @Public()
  @Get('settings/public')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @ApiOperation({ summary: 'Get affiliate program settings (commission %, discount %, etc.)' })
  getPublicSettings() {
    return this.portalService.getPublicSettings();
  }

  // GET /api/v1/affiliates/resolve?code=SARAH2024
  @Public()
  @Get('resolve')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @ApiOperation({ summary: 'Resolve affiliate discount for buyer checkout banner' })
  async resolve(@Query('code') code: string) {
    if (!code) return null;
    return this.trackingService.resolveForBuyer(code);
  }

  // POST /api/v1/affiliates/apply
  @Public()
  @Post('apply')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit affiliate application' })
  @ApiResponse({ status: 201, description: 'Application submitted' })
  apply(@Body() dto: ApplyAffiliateDto) {
    return this.portalService.applyAffiliate(dto);
  }

  // POST /api/v1/affiliates/track
  @Public()
  @Post('track')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @ApiOperation({ summary: 'Record an affiliate click (non-blocking)' })
  @ApiResponse({ status: 200, schema: { example: { received: true } } })
  track(@Body() dto: TrackClickDto, @Req() req: Request): { received: boolean } {
    this.trackingService
      .logClick({
        referralCode: dto.referralCode,
        visitorId:    dto.visitorId,
        ip:           req.ip,
        userAgent:    req.headers['user-agent'],
        landingPage:  dto.landingPage,
        referrer:     req.headers['referer'],
      })
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- fire-and-forget tracking, response below doesn't depend on it
      .catch(() => {});

    return { received: true };
  }

  // ── Authenticated portal ──────────────────────────────────────────────────────

  // GET /api/v1/affiliates/me
  @Get('me')
  @ApiOperation({ summary: 'Get current user affiliate profile' })
  getMe(@CurrentUser() user: JwtPayload) {
    return this.portalService.getMyAffiliate(user.sub);
  }

  // GET /api/v1/affiliates/me/dashboard
  @Get('me/dashboard')
  @ApiOperation({ summary: 'Affiliate dashboard — balance, stats, recent commissions' })
  async getDashboard(@CurrentUser() user: JwtPayload) {
    const affiliate = await this.portalService.getMyAffiliate(user.sub);
    if (!affiliate || affiliate.status !== 'ACTIVE') {
      throw new ForbiddenException('Affiliate account is not active.');
    }
    return this.portalService.getDashboard(affiliate.id);
  }

  // GET /api/v1/affiliates/me/clicks?page=1&limit=20
  @Get('me/clicks')
  @ApiOperation({ summary: 'Paginated click history for the authenticated affiliate' })
  async getMyClicks(
    @CurrentUser() user: JwtPayload,
    @Query('page')  page  = '1',
    @Query('limit') limit = '20',
  ) {
    const affiliate = await this.portalService.getMyAffiliate(user.sub);
    if (!affiliate || affiliate.status !== 'ACTIVE') {
      throw new ForbiddenException('Affiliate account is not active.');
    }
    return this.portalService.getMyClicks(affiliate.id, +page, +limit);
  }

  // GET /api/v1/affiliates/me/payouts
  @Get('me/payouts')
  @ApiOperation({ summary: 'Payout history for the authenticated affiliate' })
  async getMyPayouts(@CurrentUser() user: JwtPayload) {
    const affiliate = await this.portalService.getMyAffiliate(user.sub);
    if (!affiliate || affiliate.status !== 'ACTIVE') {
      throw new ForbiddenException('Affiliate account is not active.');
    }
    return this.portalService.getMyPayouts(affiliate.id);
  }

  // POST /api/v1/affiliates/me/payouts
  @Post('me/payouts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a payout request' })
  async requestPayout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestPayoutDto,
  ) {
    const affiliate = await this.portalService.getMyAffiliate(user.sub);
    if (!affiliate || affiliate.status !== 'ACTIVE') {
      throw new ForbiddenException('Affiliate account is not active.');
    }
    return this.portalService.requestPayout(affiliate.id, dto);
  }
}
