import {
  Controller, Get, Post, Delete, Patch, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { StoreOwnerGuard } from './guards/store-owner.guard';
import { StoresService } from './stores.service';
import { ApplyStoreDto } from './dto/apply-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@ApiTags('Stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  /** Public: paginated list of active stores */
  @Get()
  listStores(
    @Query('page')  page  = '1',
    @Query('limit') limit = '12',
  ) {
    return this.storesService.listStores(
      Math.max(1, parseInt(page, 10)  || 1),
      Math.min(50, Math.max(1, parseInt(limit, 10) || 12)),
    );
  }

  /** Public: store page by slug */
  @Get(':slug')
  getStoreBySlug(@Param('slug') slug: string, @Req() req: Request) {
    return this.storesService.getStoreBySlug(
      slug,
      this.buildViewLockId(req),
      req.headers['referer'] as string | undefined,
    );
  }

  /** Whether the current user follows this store — false (not 401) for guests */
  @Get(':slug/follow-status')
  @UseGuards(OptionalAuthGuard)
  getFollowStatus(@Param('slug') slug: string, @CurrentUser() user?: JwtPayload) {
    return this.storesService.getFollowStatus(slug, user?.sub);
  }

  /** Buyer: follow a shop */
  @Post(':slug/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  followStore(@Param('slug') slug: string, @Req() req: any) {
    return this.storesService.followStore(slug, req.user.sub ?? req.user.id);
  }

  /** Buyer: unfollow a shop */
  @Delete(':slug/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  unfollowStore(@Param('slug') slug: string, @Req() req: any) {
    return this.storesService.unfollowStore(slug, req.user.sub ?? req.user.id);
  }

  /** Public: product category sections with counts for the sidebar */
  @Get(':slug/sections')
  getStoreSections(@Param('slug') slug: string) {
    return this.storesService.getStoreSections(slug);
  }

  /** Public: store performance score by slug */
  @Get(':slug/score')
  getStoreScore(@Param('slug') slug: string) {
    return this.storesService.getStoreScorePublic(slug);
  }

  /** Public: store reviews rating summary */
  @Get(':slug/reviews/summary')
  getStoreReviewsSummary(@Param('slug') slug: string) {
    return this.storesService.getStoreReviewsSummary(slug);
  }

  /** Public: paginated store reviews */
  @Get(':slug/reviews')
  getStoreReviews(
    @Param('slug') slug: string,
    @Query('page')  page  = '1',
    @Query('limit') limit = '10',
  ) {
    return this.storesService.getStoreReviews(
      slug,
      Math.max(1, parseInt(page,  10) || 1),
      Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
    );
  }

  /** Seller: apply for a new store */
  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  applyForStore(@Req() req: any, @Body() dto: ApplyStoreDto) {
    return this.storesService.applyForStore(req.user.sub ?? req.user.id, dto);
  }

  /** Seller: get own store */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMyStore(@Req() req: any) {
    return this.storesService.getMyStore(req.user.sub ?? req.user.id);
  }

  /** Seller: get own store application status */
  @Get('me/application')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getMyApplication(@Req() req: any) {
    return this.storesService.getMyStoreApplication(req.user.sub ?? req.user.id);
  }

  /** Seller: update own store profile (ACTIVE stores only) */
  @Patch('me')
  @UseGuards(JwtAuthGuard, StoreOwnerGuard)
  @ApiBearerAuth()
  updateMyStore(@Req() req: any, @Body() dto: UpdateStoreDto) {
    return this.storesService.updateMyStore(req.user.sub ?? req.user.id, dto);
  }

  private buildViewLockId(req: Request): string {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? 'unknown';
    const ua = req.headers['user-agent'] ?? '';
    return Buffer.from(`${ip}:${ua}`).toString('base64').substring(0, 32);
  }
}
