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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReferralService } from './referral.service';
import { ReferralRequestPayoutDto as RequestPayoutDto } from './dto/referral.dto';
import { ReferralCommissionStatus } from '@prisma/client';

@ApiTags('referrals')
@Controller('api/v1/referrals')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('resolve')
  async resolve(@Query('code') code: string) {
    return this.referralService.resolveCode(code?.toUpperCase().trim() ?? '');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMe(@Req() req: Request) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.referralService.getMe(userId);
  }

  @Get('me/commissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyCommissions(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: ReferralCommissionStatus,
  ) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.referralService.getMyCommissions(userId, +page, +limit, status);
  }

  @Get('me/payouts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyPayouts(@Req() req: Request) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.referralService.getMyPayouts(userId);
  }

  @Post('me/payouts/request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  async requestPayout(@Req() req: Request, @Body() dto: RequestPayoutDto) {
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
