import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GiftPoolService } from './gift-pool.service';

@Controller('gift-pools')
export class GiftPoolController {
  constructor(private readonly giftPoolService: GiftPoolService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  createPool(@Request() req: any, @Body() dto: any) {
    return this.giftPoolService.createPool(req.user.sub, dto);
  }

  @Get(':token')
  getPool(@Param('token') token: string) {
    return this.giftPoolService.getPool(token);
  }

  @Post(':token/contribute')
  contribute(@Param('token') token: string, @Body() dto: any, @Request() req: any) {
    return this.giftPoolService.contribute(token, {
      ...dto,
      contributorId: req.user?.sub,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyPools(@Request() req: any) {
    return this.giftPoolService.getMyPools(req.user.sub);
  }
}
