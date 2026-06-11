import { Controller, Get, Post, Param, Request, UseGuards } from '@nestjs/common';
import { TrendsService } from './trends.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('seller/trends')
export class TrendsController {
  constructor(private readonly svc: TrendsService) {}

  @Get()
  getDrafts(@Request() req: any) {
    return this.svc.getDrafts(req.user.storeId);
  }

  @Get('topics')
  getTopics() {
    return this.svc.getTrendingTopics();
  }

  @Post(':draftId/approve')
  approveDraft(@Param('draftId') draftId: string, @Request() req: any) {
    return this.svc.approveDraft(req.user.storeId, draftId);
  }

  @Post(':draftId/reject')
  rejectDraft(@Param('draftId') draftId: string, @Request() req: any) {
    return this.svc.rejectDraft(req.user.storeId, draftId);
  }

  @Post('generate')
  generateDrafts(@Request() req: any) {
    return this.svc.generateTrendDraftsForStore(req.user.storeId);
  }
}
