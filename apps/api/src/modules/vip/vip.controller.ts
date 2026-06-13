import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VipService } from './vip.service';

@ApiTags('VIP')
@Controller('vip')
@UseGuards(JwtAuthGuard)
export class VipController {
  constructor(private readonly vipService: VipService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user VIP tier and status' })
  getVipStatus(@CurrentUser('sub') userId: string) {
    return this.vipService.getVipStatus(userId);
  }

  @Get('flash-deals/preview')
  @ApiOperation({ summary: 'Get upcoming VIP-only flash deals (early access preview)' })
  getEarlyAccessDeals(@CurrentUser('sub') userId: string) {
    return this.vipService.getEarlyAccessDeals(userId);
  }
}
