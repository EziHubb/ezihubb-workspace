import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { BlindMatchService } from './blind-match.service';

@Controller('blind-match')
export class BlindMatchController {
  constructor(private readonly blindMatchService: BlindMatchService) {}

  @Public()
  @Get('hall-of-fame')
  getHallOfFame(@Query('limit') limit = '10') {
    return this.blindMatchService.getHallOfFame(parseInt(limit, 10) || 10);
  }

  @Public()
  @Get('ugc')
  getUgc(@Query('limit') limit = '12') {
    return this.blindMatchService.getUgc(parseInt(limit, 10) || 12);
  }

  @UseGuards(JwtAuthGuard)
  @Post('request')
  requestMatch(@Request() req: any, @Body() dto: any) {
    return this.blindMatchService.requestMatch(req.user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':requestId/mystery')
  getMystery(@Param('requestId') requestId: string, @Request() req: any) {
    return this.blindMatchService.getMystery(requestId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':requestId/reveal')
  revealProduct(@Param('requestId') requestId: string, @Request() req: any) {
    return this.blindMatchService.revealProduct(requestId, req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':requestId/rate')
  rateMatch(
    @Param('requestId') requestId: string,
    @Request() req: any,
    @Body() dto: any,
  ) {
    return this.blindMatchService.rateMatch(requestId, req.user.sub, dto.score, dto.note);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  getHistory(@Request() req: any) {
    return this.blindMatchService.getHistory(req.user.sub);
  }
}
