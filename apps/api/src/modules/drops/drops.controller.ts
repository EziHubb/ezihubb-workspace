import {
  Controller, Post, Get, Patch, Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { DropsService } from './drops.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller()
export class DropsController {
  constructor(private readonly svc: DropsService) {}

  // ── Public ────────────────────────────────────────────────────────────────

  @UseGuards(OptionalAuthGuard)
  @Post('products/:slug/waitlist')
  joinWaitlist(
    @Param('slug') slug: string,
    @Body() body: { email: string },
    @Request() req: any,
  ) {
    return this.svc.joinWaitlist(slug, body.email, req.user?.id);
  }

  @Public()
  @Get('products/:slug/waitlist/count')
  getWaitlistCount(@Param('slug') slug: string) {
    return this.svc.getWaitlistCount(slug);
  }

  // ── Seller ────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Patch('seller/products/:id/drops')
  configureDrop(
    @Param('id') id: string,
    @Body() body: {
      isDrop: boolean;
      dropLaunchAt?: string;
      dropQuantityLimit?: number;
      dropWaitlistOpen?: boolean;
      dropEndAt?: string;
    },
    @Request() req: any,
  ) {
    return this.svc.configureDrop(id, req.user.storeId, body);
  }
}
