import {
  Controller, Get, Post, Put, Delete, Param, Query, Body, Request,
  UseGuards, NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { PricingService }       from '../pricing/pricing.service';
import { TrendsService }        from '../trends/trends.service';
import { CreatorDnaService }    from '../creator-dna/creator-dna.service';
import { AiStatsService }       from './ai-stats.service';
import { TrendSourceRegistry }  from '../trends/source-registry.service';

@ApiTags('Admin AI')
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminAiController {
  constructor(
    private readonly pricingService:    PricingService,
    private readonly trendsService:     TrendsService,
    private readonly creatorDnaService: CreatorDnaService,
    private readonly aiStatsService:    AiStatsService,
    private readonly sourceRegistry:    TrendSourceRegistry,
  ) {}

  // ── Stats ─────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Aggregate AI feature stats across the platform' })
  getStats() {
    return this.aiStatsService.getOverallStats();
  }

  // ── AI Settings ───────────────────────────────────────────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get AI feature settings' })
  getSettings() {
    return this.aiStatsService.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update AI feature settings' })
  updateSettings(@Body() body: Record<string, unknown>) {
    return this.aiStatsService.updateSettings(body);
  }

  // ── AI Usage ─────────────────────────────────────────────────────────────

  @Get('usage')
  @ApiOperation({ summary: 'Get AI API usage and cost metrics' })
  getUsage(@Query('days') days?: string) {
    return this.aiStatsService.getUsageMetrics(days ? +days : 30);
  }

  // ── Pricing (A/B Tests) ───────────────────────────────────────────────────

  @Get('pricing/stats')
  @ApiOperation({ summary: 'Aggregate stats for all A/B pricing tests' })
  getPricingStats() {
    return this.pricingService.getAdminStats();
  }

  @Get('pricing/tests')
  @ApiOperation({ summary: 'List all A/B pricing tests' })
  getPricingTests(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pricingService.listTests(page ? +page : 1, limit ? +limit : 20);
  }

  @Post('pricing/tests/:id/end')
  @ApiOperation({ summary: 'Cancel an A/B pricing test' })
  endPricingTest(@Param('id') id: string) {
    return this.pricingService.cancelTest(id);
  }

  @Post('pricing/tests/:id/revert')
  @ApiOperation({ summary: 'Revert an A/B pricing test (cancel and restore price A)' })
  revertPricingTest(@Param('id') id: string) {
    return this.pricingService.revertTest(id);
  }

  @Get('pricing/products/:productId/recommendation')
  @ApiOperation({ summary: 'Get AI pricing recommendation for a product (admin)' })
  async getProductPricingRecommendation(@Param('productId') productId: string) {
    return this.pricingService.adminGetRecommendation(productId);
  }

  @Post('pricing/products/:productId/ab-test')
  @ApiOperation({ summary: 'Start an A/B pricing test for a product (admin)' })
  async startProductABTest(@Param('productId') productId: string) {
    return this.pricingService.adminStartABTest(productId);
  }

  @Get('pricing/products/:productId/ab-test')
  @ApiOperation({ summary: 'Get current A/B test status for a product (admin)' })
  async getProductABTestStatus(@Param('productId') productId: string) {
    return this.pricingService.adminGetTestStatus(productId);
  }

  // ── Creator DNA ───────────────────────────────────────────────────────────

  @Get('creator-dna')
  @ApiOperation({ summary: 'List all creator DNA analyses' })
  getCreatorDna(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.creatorDnaService.listAnalyses(page ? +page : 1, limit ? +limit : 20);
  }

  @Post('creator-dna/:id/reanalyze')
  @ApiOperation({ summary: 'Trigger re-analysis of a creator DNA profile' })
  reanalyzeCreatorDna(@Param('id') id: string) {
    return this.creatorDnaService.queueReanalysis(id);
  }

  @Get('creator-dna/platforms')
  @ApiOperation({ summary: 'Get connected social platforms for the current admin user' })
  getCreatorDnaPlatforms(@Request() req: any) {
    return this.creatorDnaService.getConnectedPlatforms(req.user.id);
  }

  @Delete('creator-dna/platforms/:platform')
  @ApiOperation({ summary: 'Disconnect a social platform for the current admin user' })
  disconnectCreatorDnaPlatform(@Param('platform') platform: string, @Request() req: any) {
    return this.creatorDnaService.disconnect(req.user.id, platform);
  }

  @Post('creator-dna/fetch')
  @ApiOperation({ summary: 'Fetch social data and run Creator DNA analysis for the current admin user' })
  fetchCreatorDna(@Body() body: { platform: string }, @Request() req: any) {
    return this.creatorDnaService.runAnalysis(req.user.id, body.platform);
  }

  // ── Trend Drafts ──────────────────────────────────────────────────────────

  @Get('trend-drafts/pending-count')
  @ApiOperation({ summary: 'Count of trend product drafts awaiting admin review' })
  getTrendDraftsPendingCount() {
    return this.trendsService.getPendingCount();
  }

  @Get('trend-drafts')
  @ApiOperation({ summary: 'List trend product drafts' })
  getTrendDrafts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.trendsService.listDrafts(page ? +page : 1, limit ? +limit : 20, status);
  }

  @Post('trend-drafts/:id/approve')
  @ApiOperation({ summary: 'Approve a trend product draft' })
  approveTrendDraft(@Param('id') id: string) {
    return this.trendsService.adminApproveDraft(id);
  }

  @Post('trend-drafts/:id/reject')
  @ApiOperation({ summary: 'Reject a trend product draft' })
  rejectTrendDraft(@Param('id') id: string) {
    return this.trendsService.adminRejectDraft(id);
  }

  @Post('trend-drafts/:id/create-product')
  @ApiOperation({ summary: 'Create a product from an approved trend draft' })
  createProductFromDraft(@Param('id') id: string) {
    return this.trendsService.adminCreateProductFromDraft(id);
  }

  @Get('sources')
  @ApiOperation({ summary: 'List available trend sources with metadata' })
  getTrendSources() {
    return this.sourceRegistry.getSourcesMeta();
  }

  @Post('trends/trigger-scan')
  @ApiOperation({ summary: 'Trigger a synchronous trend scan — creates drafts immediately, skips image generation' })
  triggerTrendScan(@Body() body: { sources?: string[] } = {}) {
    return this.trendsService.triggerAdminDirectScan(body.sources);
  }
}
