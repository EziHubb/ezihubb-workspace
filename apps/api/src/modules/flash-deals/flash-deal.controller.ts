import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
