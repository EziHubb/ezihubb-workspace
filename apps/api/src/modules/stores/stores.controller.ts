import {
  Controller, Get, Post, Patch, Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreOwnerGuard } from './guards/store-owner.guard';
import { StoresService } from './stores.service';
import { ApplyStoreDto } from './dto/apply-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

@ApiTags('Stores')
@Controller('stores')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  /** Public: store page by slug */
  @Get(':slug')
  getStoreBySlug(@Param('slug') slug: string) {
    return this.storesService.getStoreBySlug(slug);
  }

  /** Public: store performance score by slug */
  @Get(':slug/score')
  getStoreScore(@Param('slug') slug: string) {
    return this.storesService.getStoreScorePublic(slug);
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
}
