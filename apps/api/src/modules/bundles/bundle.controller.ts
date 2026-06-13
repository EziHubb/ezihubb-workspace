import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BundleService } from './bundle.service';

@Controller('bundles')
export class BundleController {
  constructor(private readonly bundleService: BundleService) {}

  @Get(':storeId/settings')
  getSettings(@Param('storeId') storeId: string) {
    return this.bundleService.getStoreSettings(storeId);
  }

  @Get(':storeId/upsell')
  getUpsell(
    @Param('storeId') storeId: string,
    @Query('itemCount') itemCount: string,
  ) {
    return this.bundleService.getUpsellSuggestions(storeId, parseInt(itemCount ?? '0', 10));
  }

  @UseGuards(JwtAuthGuard)
  @Post(':storeId/settings')
  upsertSettings(@Param('storeId') storeId: string, @Body() dto: any) {
    return this.bundleService.upsertStoreSettings(storeId, dto);
  }
}
