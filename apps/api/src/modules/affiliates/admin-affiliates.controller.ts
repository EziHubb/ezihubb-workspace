import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAffiliatesService } from './admin-affiliates.service';
import {
  ApproveAffiliateDto,
  RejectAffiliateDto,
  UpdateAffiliateDto,
  UpdateAffiliateSettingsDto,
  AdminPayoutActionDto,
  RejectPayoutDto,
} from './dto/admin-affiliate.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@ezihubb/constants';

// Affiliates are a platform-wide program with no per-store concept at all
// (unlike Reviews/Messages/Promotions) — a store-owner ADMIN has no
// legitimate reason to view or act on ANY affiliate's application/payout,
// so this whole controller is SUPER_ADMIN-only, not the usual
// @AdminController('affiliates') which also admits ADMIN.
@Controller('admin/affiliates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
@ApiBearerAuth()
@ApiTags('Admin — Affiliates')
export class AdminAffiliatesController {
  constructor(private readonly adminAffiliatesService: AdminAffiliatesService) {}

  // ── IMPORTANT: literal routes before :id to avoid param conflicts ───────────

  // GET /admin/affiliates/pending-count
  @Get('pending-count')
  @ApiOperation({ summary: 'Count of PENDING affiliate applications (for sidebar badge)' })
  async getPendingCount() {
    const count = await this.adminAffiliatesService.getPendingCount();
    return { count };
  }

  // GET /admin/affiliates/settings
  @Get('settings')
  @ApiOperation({ summary: 'Get affiliate program settings' })
  getSettings() {
    return this.adminAffiliatesService.getSettings();
  }

  // PATCH /admin/affiliates/settings
  @Patch('settings')
  @ApiOperation({ summary: 'Update affiliate program settings' })
  updateSettings(@Body() dto: UpdateAffiliateSettingsDto) {
    return this.adminAffiliatesService.updateSettings(dto);
  }

  // GET /admin/affiliates/payouts
  @Get('payouts')
  @ApiOperation({ summary: 'List payout requests' })
  listPayouts(
    @Query('status') status?: string,
    @Query('page')   page   = '1',
    @Query('limit')  limit  = '20',
  ) {
    return this.adminAffiliatesService.listPayouts({ status, page: +page, limit: +limit });
  }

  // POST /admin/affiliates/payouts/:id/pay
  @Post('payouts/:id/pay')
  @ApiOperation({ summary: 'Mark a payout as paid' })
  markPayoutPaid(
    @Param('id') id: string,
    @Body() dto: AdminPayoutActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminAffiliatesService.markPayoutPaid(id, dto, user.sub);
  }

  // POST /admin/affiliates/payouts/:id/reject
  @Post('payouts/:id/reject')
  @ApiOperation({ summary: 'Reject a payout request (restores affiliate balance)' })
  rejectPayout(
    @Param('id') id: string,
    @Body() dto: RejectPayoutDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminAffiliatesService.rejectPayout(id, dto, user.sub);
  }

  // ── List / CRUD ─────────────────────────────────────────────────────────────

  // GET /admin/affiliates
  @Get()
  @ApiOperation({ summary: 'List all affiliates (filterable by status, searchable)' })
  listAffiliates(
    @Query('status') status?: string,
    @Query('page')   page   = '1',
    @Query('limit')  limit  = '20',
    @Query('search') search?: string,
  ) {
    return this.adminAffiliatesService.listAffiliates({ status, page: +page, limit: +limit, search });
  }

  // GET /admin/affiliates/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get affiliate detail with stats, commission history, and recent clicks' })
  getAffiliate(@Param('id') id: string) {
    return this.adminAffiliatesService.getAffiliate(id);
  }

  // POST /admin/affiliates/:id/approve
  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve affiliate application' })
  approveAffiliate(
    @Param('id') id: string,
    @Body() dto: ApproveAffiliateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminAffiliatesService.approveAffiliate(id, dto, user.sub);
  }

  // POST /admin/affiliates/:id/reject
  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject affiliate application' })
  rejectAffiliate(
    @Param('id') id: string,
    @Body() dto: RejectAffiliateDto,
  ) {
    return this.adminAffiliatesService.rejectAffiliate(id, dto);
  }

  // PATCH /admin/affiliates/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Update affiliate status, commission rate, or admin notes' })
  updateAffiliate(
    @Param('id') id: string,
    @Body() dto: UpdateAffiliateDto,
  ) {
    return this.adminAffiliatesService.updateAffiliate(id, dto);
  }
}
