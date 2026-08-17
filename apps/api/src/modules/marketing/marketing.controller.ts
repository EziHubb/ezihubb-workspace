import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { LinkAttributionService } from './link-attribution.service';
import { ShareSaveService } from './share-save.service';
import { OffsiteAdsService } from './offsite-ads.service';
import { TargetedOffersService, UpsertCampaignInput } from './targeted-offers.service';
import { SocialService } from './social.service';
import { TrackClickDto } from './dto/track-click.dto';
import { UpsertTargetedOfferCampaignDto } from './dto/targeted-offer-campaign.dto';
import { CreateSocialPostDto } from './dto/social.dto';
import { SocialPlatform } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { StoreContextService } from '../../common/services/store-context.service';

@ApiTags('marketing')
@Controller('marketing')
export class MarketingController {
  constructor(
    private readonly linkAttribution: LinkAttributionService,
    private readonly shareSaveService: ShareSaveService,
    private readonly offsiteAdsService: OffsiteAdsService,
    private readonly targetedOffersService: TargetedOffersService,
    private readonly socialService: SocialService,
    private readonly storeContext: StoreContextService,
  ) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  @Public()
  @Post('track-click')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @ApiOperation({ summary: 'Record a Share & Save or Offsite Ads link click (non-blocking)' })
  track(@Body() dto: TrackClickDto, @Req() req: Request): { received: boolean } {
    if (dto.kind === 'OFFSITE_AD') {
      // An Offsite Ads click must carry a real external Referer — this is the
      // only signal distinguishing genuine ad-driven traffic from a caller
      // directly POSTing a fabricated click (which would otherwise mint an
      // unearned attribution and debit the seller an ad fee for nothing).
      const source = this.extractHost(req.headers['referer']);
      if (!source) return { received: false };
      this.linkAttribution
        .trackClick({ ...dto, source })
        // eslint-disable-next-line @typescript-eslint/no-empty-function -- fire-and-forget tracking
        .catch(() => {});
      return { received: true };
    }

    this.linkAttribution
      .trackClick(dto)
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- fire-and-forget tracking
      .catch(() => {});
    return { received: true };
  }

  // ── Admin: Share & Save ──────────────────────────────────────────────────────

  @Get('share-save')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get Share & Save status + 30-day stats for the current store' })
  async getShareSaveStatus(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.shareSaveService.getStatus(storeId);
  }

  @Post('share-save/join')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Join Share & Save' })
  async joinShareSave(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.shareSaveService.join(storeId);
  }

  @Post('share-save/leave')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Leave Share & Save' })
  async leaveShareSave(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.shareSaveService.leave(storeId);
  }

  // ── Admin: Offsite Ads ───────────────────────────────────────────────────────

  @Get('offsite-ads')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get Offsite Ads performance stats for the current store' })
  async getOffsiteAdsStats(@Req() req: Request, @Query('days') days?: string, @Query('offsetDays') offsetDays?: string) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.offsiteAdsService.getStats(storeId, days ? Number(days) : undefined, offsetDays ? Number(offsetDays) : undefined);
  }

  @Patch('offsite-ads/opt-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Opt in/out of Offsite Ads' })
  async setOffsiteAdsOptOut(@Req() req: Request, @Body('optedOut') optedOut: boolean) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.offsiteAdsService.setOptOut(storeId, !!optedOut);
  }

  // ── Admin: Targeted offers ──────────────────────────────────────────────────

  @Get('targeted-offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List targeted-offer campaigns (one per trigger) for the current store' })
  async listTargetedOffers(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.targetedOffersService.listCampaigns(storeId);
  }

  @Post('targeted-offers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create or update a targeted-offer campaign' })
  async upsertTargetedOffer(@Req() req: Request, @Body() dto: UpsertTargetedOfferCampaignDto) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.targetedOffersService.upsertCampaign(storeId, dto as UpsertCampaignInput);
  }

  // ── Admin: Social media (UI-parity only) ────────────────────────────────────

  @Get('social/connections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get social account connection status (UI-only, no real OAuth)' })
  async getSocialConnections(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.socialService.getConnections(storeId);
  }

  @Patch('social/connections/:platform')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Connect/disconnect a social account (UI-only stub)' })
  async setSocialConnection(
    @Req() req: Request,
    @Param('platform') platform: SocialPlatform,
    @Body('connect') connect: boolean,
  ) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.socialService.setConnection(storeId, platform, !!connect);
  }

  @Get('social/content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Newest listings + active sales, for the Create Post wizard and homepage rows' })
  async getSocialContent(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.socialService.getShareableContent(storeId);
  }

  @Get('social/posts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: "List this store's own post history" })
  async listSocialPosts(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.socialService.listPosts(storeId);
  }

  @Post('social/posts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Save a post to history — no real external publish happens' })
  async createSocialPost(@Req() req: Request, @Body() dto: CreateSocialPostDto) {
    const context = await this.storeContext.resolve(req);
    const storeId = this.storeContext.requireStoreId(context);
    return this.socialService.createPost(storeId, dto.content, dto.imageUrl, dto.platforms);
  }

  private extractHost(referer?: string): string | undefined {
    if (!referer) return undefined;
    try {
      return new URL(referer).hostname.replace(/^www\./, '');
    } catch {
      return undefined;
    }
  }
}
