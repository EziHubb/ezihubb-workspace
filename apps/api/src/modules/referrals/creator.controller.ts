import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReferralService } from './referral.service';
import { ReferralRequestPayoutDto as RequestPayoutDto } from './dto/referral.dto';
import { ReferralCommissionStatus } from '@prisma/client';

@ApiTags('creators')
@Controller('api/v1/creators')
export class CreatorController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('public-stats')
  async getPublicStats() {
    return this.referralService.getPublicStats();
  }

  @Get('resolve')
  async resolve(@Query('code') code: string) {
    return this.referralService.resolveCode(code?.toUpperCase().trim() ?? '');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMe(@Req() req: Request) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.referralService.getCreatorMe(userId);
  }

  @Get('me/earnings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyEarnings(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: ReferralCommissionStatus,
  ) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.referralService.getCreatorEarnings(userId, +page, +limit, status);
  }

  @Get('me/withdrawals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyWithdrawals(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.referralService.getCreatorWithdrawals(userId, +page, +limit);
  }

  @Post('me/withdrawals/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  async requestWithdrawal(@Req() req: Request, @Body() dto: RequestPayoutDto) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    await this.referralService.requestPayout(userId, dto);
    return { success: true };
  }

  @Get('me/tree')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyTree(@Req() req: Request) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.referralService.getMyTree(userId);
  }
}
