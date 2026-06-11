import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller()
export class BountiesController {
  constructor(private readonly svc: BountiesService) {}

  @Get('marketplace/bounties')
  listBounties(@Query() q: { page?: string; limit?: string; status?: string }) {
    return this.svc.listBounties({
      page:   q.page   ? parseInt(q.page)   : undefined,
      limit:  q.limit  ? parseInt(q.limit)  : undefined,
      status: q.status,
    });
  }

  @Get('marketplace/bounties/:id')
  getBounty(@Param('id') id: string) {
    return this.svc.getBounty(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('marketplace/bounties')
  createBounty(@Body() dto: any, @Request() req: any) {
    return this.svc.createBounty(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('marketplace/bounties/:id/entries')
  submitEntry(@Param('id') id: string, @Body() dto: any, @Request() req: any) {
    return this.svc.submitEntry(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('marketplace/bounties/:id/select-winner')
  selectWinner(@Param('id') id: string, @Body() body: { entryId: string }, @Request() req: any) {
    return this.svc.selectWinner(req.user.id, id, body.entryId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('marketplace/bounties/me')
  getMyBounties(@Request() req: any) {
    return this.svc.getMyBounties(req.user.id);
  }
}
