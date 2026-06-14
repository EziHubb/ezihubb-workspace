import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';
import { CampaignsService } from './campaigns.service';
import { UpdateCampaignDto } from './dto/campaign.dto';

@ApiTags('Admin – Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/campaigns')
export class CampaignsController {
  constructor(private readonly svc: CampaignsService) {}

  @Get('stats')
  getStats() {
    return this.svc.getStats();
  }

  @Get()
  findAll(@Query('season') season?: string) {
    return this.svc.findAll(season);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.svc.activate(id);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.svc.deactivate(id);
  }
}
