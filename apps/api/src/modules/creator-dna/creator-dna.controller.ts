import { Controller, Get, Post, Delete, Param, Query, Request, UseGuards, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CreatorDnaService } from './creator-dna.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('creator-dna')
export class CreatorDnaController {
  constructor(private readonly svc: CreatorDnaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('tiktok/connect')
  connectTikTok(@Request() req: any, @Res() res: Response) {
    res.redirect(this.svc.getTikTokAuthUrl(req.user.id));
  }

  @Get('tiktok/callback')
  async tiktokCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    await this.svc.handleTikTokCallback(code, state);
    res.redirect(`${process.env['CLIENT_URL'] ?? 'http://localhost:3000'}/seller/creator-dna?platform=tiktok`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('instagram/connect')
  connectInstagram(@Request() req: any, @Res() res: Response) {
    res.redirect(this.svc.getInstagramAuthUrl(req.user.id));
  }

  @Get('instagram/callback')
  async instagramCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    await this.svc.handleInstagramCallback(code, state);
    res.redirect(`${process.env['CLIENT_URL'] ?? 'http://localhost:3000'}/seller/creator-dna?platform=instagram`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('analysis')
  getAnalysis(@Request() req: any) {
    return this.svc.getAnalysis(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('platforms')
  getPlatforms(@Request() req: any) {
    return this.svc.getConnectedPlatforms(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('platforms/:platform')
  disconnect(@Param('platform') platform: string, @Request() req: any) {
    return this.svc.disconnect(req.user.id, platform);
  }
}
