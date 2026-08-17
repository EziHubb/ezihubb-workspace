import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

// ── Public ────────────────────────────────────────────────────────────────────

@ApiTags('Campaigns')
@Controller('campaigns')
export class CampaignsPublicController {
  constructor(private readonly svc: CampaignsService) {}

  @Get('active')
  getActive() {
    return this.svc.getActive();
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────────

// Campaigns are a platform-wide homepage program with no per-store concept
// at all (campaigns.service.ts has no storeId anywhere) — unlike Reviews/
// Messages/Promotions, a store-owner ADMIN has no legitimate reason to
// create/edit/activate the marketplace's own homepage banner, so this whole
// controller is SUPER_ADMIN-only, not the usual @AdminController('campaigns')
// which would also admit ADMIN. Same reasoning as admin-affiliates.controller.ts.
@ApiTags('Admin – Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@Controller('admin/campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Get('stats')
  getStats() { return this.svc.getStats(); }

  @Get()
  findAll(@Query('season') season?: string) { return this.svc.findAll(season); }

  @Post()
  create(@Body() dto: CreateCampaignDto) { return this.svc.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) { return this.svc.update(id, dto); }

  @Delete(':id')
  delete(@Param('id') id: string) { return this.svc.delete(id); }

  @Post(':id/activate')
  activate(@Param('id') id: string) { return this.svc.activate(id); }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) { return this.svc.deactivate(id); }
}
