import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FlashDealService } from './flash-deal.service';

@Controller('flash-deals')
export class FlashDealController {
  constructor(private readonly flashDealService: FlashDealService) {}

  @Get('active')
  getActiveDeals() {
    return this.flashDealService.getActiveDeals();
  }

  @Get(':id')
  getDeal(@Param('id') id: string) {
    return this.flashDealService.getDeal(id);
  }
}

@Controller('admin/flash-deals')
export class AdminFlashDealController {
  constructor(private readonly flashDealService: FlashDealService) {}

  // Static routes before parameterised :id to avoid NestJS shadowing

  @UseGuards(JwtAuthGuard)
  @Get('stats')
  getStats() {
    return this.flashDealService.getAdminStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  listDeals(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    const isShopOwner = req.user?.role === 'ADMIN';
    return this.flashDealService.findAdmin({
      status,
      page:    parseInt(page  ?? '1',  10) || 1,
      limit:   parseInt(limit ?? '20', 10) || 20,
      storeId: isShopOwner ? (req.user?.storeId ?? undefined) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  reviewDeal(@Param('id') id: string, @Body() payload: any) {
    return this.flashDealService.reviewDeal(id, payload);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createDeal(@Body() dto: any) {
    return this.flashDealService.createDeal(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/approve')
  approveDeal(@Param('id') id: string) {
    return this.flashDealService.approveDeal(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/toggle')
  toggleDeal(@Param('id') id: string) {
    return this.flashDealService.toggleDeal(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/cancel')
  cancelDeal(@Param('id') id: string) {
    return this.flashDealService.cancelDeal(id);
  }
}
