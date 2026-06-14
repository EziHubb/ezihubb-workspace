import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GiftPoolService } from './gift-pool.service';

@Controller('gift-pools')
export class GiftPoolController {
  constructor(private readonly giftPoolService: GiftPoolService) {}

  // Static routes must come before parameterised :token to avoid shadowing

  @Get('public')
  findPublic(@Query('limit') limit?: string) {
    return this.giftPoolService.findPublic(parseInt(limit ?? '6', 10) || 6);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyPools(@Request() req: any) {
    return this.giftPoolService.getMyPools(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  createPool(@Request() req: any, @Body() dto: any) {
    return this.giftPoolService.createPool(req.user.sub, dto);
  }

  @Get(':token')
  getPool(@Param('token') token: string, @Query('limit') limit?: string) {
    if (token === 'public') return this.giftPoolService.findPublic(parseInt(limit ?? '6', 10) || 6);
    return this.giftPoolService.getPool(token);
  }

  @Post(':token/contribute')
  contribute(@Param('token') token: string, @Body() dto: any, @Request() req: any) {
    return this.giftPoolService.contribute(token, {
      ...dto,
      contributorId: req.user?.sub,
    });
  }
}

@Controller('admin/gift-pools')
@UseGuards(JwtAuthGuard)
export class AdminGiftPoolController {
  constructor(private readonly giftPoolService: GiftPoolService) {}

  // Static routes before :id

  @Get('stats')
  getStats() {
    return this.giftPoolService.getAdminStats();
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('page')   page?:   string,
    @Query('limit')  limit?:  string,
  ) {
    return this.giftPoolService.findAdmin({
      status,
      page:  parseInt(page  ?? '1',  10) || 1,
      limit: parseInt(limit ?? '20', 10) || 20,
    });
  }

  @Patch(':id/close')
  closePool(@Param('id') id: string) {
    return this.giftPoolService.adminClose(id);
  }
}
