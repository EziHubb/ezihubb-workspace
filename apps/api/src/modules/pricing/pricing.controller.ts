import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreOwnerGuard } from '../stores/guards/store-owner.guard';

@UseGuards(JwtAuthGuard, StoreOwnerGuard)
@ApiBearerAuth()
@ApiTags('Seller - Pricing')
@Controller('seller/products/:id/pricing')
export class PricingController {
  constructor(private readonly svc: PricingService) {}

  @Get('recommendation')
  @ApiOperation({ summary: 'Get AI pricing recommendation for a product' })
  getRecommendation(@Param('id') id: string, @Request() req: any) {
    return this.svc.getRecommendation(id, req.store.id);
  }

  @Post('ab-test')
  @ApiOperation({ summary: 'Start an A/B pricing test using AI recommendation' })
  startABTest(@Param('id') id: string, @Request() req: any) {
    return this.svc.startABTest(id, req.store.id);
  }

  @Get('ab-test')
  @ApiOperation({ summary: 'Get current A/B test status for a product' })
  getTestStatus(@Param('id') id: string, @Request() req: any) {
    return this.svc.getTestStatus(id, req.store.id);
  }
}
