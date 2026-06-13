import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CoinService } from './coin.service';

class RedeemCoinsDto {
  coins!: number;
}

@ApiTags('Coins')
@Controller('coins')
@UseGuards(JwtAuthGuard)
export class CoinController {
  constructor(private readonly coinService: CoinService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user coin balance' })
  getBalance(@CurrentUser('sub') userId: string) {
    return this.coinService.getBalance(userId);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Get current user coin transaction history' })
  getHistory(
    @CurrentUser('sub') userId: string,
    @Query('page')  pageStr?:  string,
    @Query('limit') limitStr?: string,
  ) {
    const page  = pageStr  ? Math.max(1, parseInt(pageStr,  10)) : 1;
    const limit = limitStr ? Math.min(100, parseInt(limitStr, 10)) : 20;
    return this.coinService.getHistory(userId, page, limit);
  }

  @Post('me/redeem')
  @ApiOperation({ summary: 'Redeem coins for a discount' })
  redeemCoins(
    @CurrentUser('sub') userId: string,
    @Body() body: RedeemCoinsDto,
  ) {
    return this.coinService.redeemCoins(userId, body.coins);
  }

  @Get('me/estimate')
  @ApiOperation({ summary: 'Estimate coins earned from an order total' })
  estimateCoins(@Query('orderTotal') orderTotalStr?: string) {
    const orderTotal = orderTotalStr ? parseFloat(orderTotalStr) : 0;
    return { coinsToEarn: Math.floor(orderTotal * 10) };
  }
}
