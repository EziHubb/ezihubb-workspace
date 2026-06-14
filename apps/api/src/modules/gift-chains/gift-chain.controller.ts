import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GiftChainService } from './gift-chain.service';

@Controller('gift-chains')
export class GiftChainController {
  constructor(private readonly giftChainService: GiftChainService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  initiateChain(@Request() req: any, @Body() dto: any) {
    return this.giftChainService.initiateChain(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMyChains(@Request() req: any) {
    return this.giftChainService.getMyChains(req.user.sub);
  }

  @Get(':chainId')
  getChain(@Param('chainId') chainId: string) {
    return this.giftChainService.getChain(chainId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':chainId/forward')
  forwardChain(
    @Param('chainId') chainId: string,
    @Request() req: any,
    @Body('recipientEmail') email: string,
    @Body('productId') productId: string,
  ) {
    return this.giftChainService.forwardChain(chainId, req.user.sub, email, productId);
  }
}
