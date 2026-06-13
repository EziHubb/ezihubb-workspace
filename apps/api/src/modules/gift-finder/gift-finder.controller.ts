import { Controller, Post, Get, Body, Param, Request } from '@nestjs/common';
import { GiftFinderService } from './gift-finder.service';

@Controller('gift-finder')
export class GiftFinderController {
  constructor(private readonly giftFinderService: GiftFinderService) {}

  @Post('session')
  startSession(@Request() req: any) {
    return this.giftFinderService.startSession(req.user?.sub);
  }

  @Post('session/:sessionToken/step')
  processStep(
    @Param('sessionToken') sessionToken: string,
    @Body('answer') answer: string,
  ) {
    return this.giftFinderService.processStep(sessionToken, answer);
  }

  @Get('session/:sessionToken/results')
  getResults(@Param('sessionToken') sessionToken: string) {
    return this.giftFinderService.getResults(sessionToken);
  }
}
