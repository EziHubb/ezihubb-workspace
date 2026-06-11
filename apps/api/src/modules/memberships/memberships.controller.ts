import {
  Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
export class MembershipsController {
  constructor(private readonly svc: MembershipsService) {}

  // ── Public ────────────────────────────────────────────────────────────────

  @Get('stores/:slug/membership')
  getStoreMembership(@Param('slug') slug: string) {
    return this.svc.getStoreMembership(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Get('memberships/me/:storeId')
  isFan(@Param('storeId') storeId: string, @Request() req: any) {
    return this.svc.isFan(req.user.id, storeId);
  }

  // ── Buyer: subscribe / cancel ─────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('memberships/:membershipId/subscribe')
  subscribe(@Param('membershipId') membershipId: string, @Request() req: any) {
    return this.svc.subscribe(req.user.id, membershipId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('memberships/:storeId/cancel')
  cancel(@Param('storeId') storeId: string, @Request() req: any) {
    return this.svc.cancel(req.user.id, storeId);
  }

  // ── Seller: manage ────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('seller/membership')
  createMembership(
    @Body() dto: { name: string; description: string; price: number; perks: string[] },
    @Request() req: any,
  ) {
    return this.svc.createMembership(req.user.storeId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('seller/membership/:id')
  updateMembership(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; price?: number; perks?: string[]; isActive?: boolean },
    @Request() req: any,
  ) {
    return this.svc.updateMembership(id, req.user.storeId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('seller/membership/stats')
  getMembershipStats(@Request() req: any) {
    return this.svc.getMembershipStats(req.user.storeId);
  }
}
