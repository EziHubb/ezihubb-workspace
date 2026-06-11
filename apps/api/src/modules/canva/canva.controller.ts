import {
  Controller, Get, Post, Delete, Param, Query, Body, Request,
  UseGuards, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CanvaService } from './canva.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('canva')
export class CanvaController {
  constructor(private readonly svc: CanvaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('authorize')
  authorize(@Request() req: any, @Res() res: Response) {
    const url = this.svc.getAuthorizationUrl(req.user.id);
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    await this.svc.handleCallback(code, state);
    res.redirect(`${process.env['CLIENT_URL'] ?? 'http://localhost:3000'}/seller/store?canva=connected`);
  }

  @UseGuards(JwtAuthGuard)
  @Get('products')
  getProducts(@Request() req: any) {
    return this.svc.getSellerProducts(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('publish')
  @UseInterceptors(FileInterceptor('image'))
  publishDesign(
    @UploadedFile() file: Express.Multer.File,
    @Body('productId') productId: string,
    @Request() req: any,
  ) {
    return this.svc.publishDesign(req.user.id, productId, file.buffer, file.mimetype);
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@Request() req: any) {
    return this.svc.getIntegrationStatus(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  disconnect(@Request() req: any) {
    return this.svc.disconnect(req.user.id);
  }
}
