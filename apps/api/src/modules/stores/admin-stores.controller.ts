import {
  Get, Post, Patch, Delete, Body, Param, Query, Req,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoresService } from './stores.service';

export class MarkPayoutPaidDto {
  paymentMethod: string;
  @IsOptional() @IsString() paymentDetail?: string;
  @IsOptional() @IsString() adminNotes?: string;
}
import {
  ApproveStoreDto, RejectStoreDto, SuspendStoreDto, AssignPlanDto,
  AdminListStoresDto, CreateSellerPlanDto, UpdateSellerPlanDto,
  UpdatePlatformSettingsDto,
} from './dto/admin-stores.dto';

@AdminController('stores')
export class AdminStoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  listStores(@Query() dto: AdminListStoresDto) {
    return this.storesService.adminListStores(dto);
  }

  @Get(':id')
  getStore(@Param('id') id: string) {
    return this.storesService.adminGetStore(id);
  }

  @Post(':id/approve')
  approveStore(@Param('id') id: string, @Req() req: any, @Body() dto: ApproveStoreDto) {
    return this.storesService.adminApproveStore(id, req.user.sub ?? req.user.id, dto);
  }

  @Post(':id/reject')
  rejectStore(@Param('id') id: string, @Req() req: any, @Body() dto: RejectStoreDto) {
    return this.storesService.adminRejectStore(id, req.user.sub ?? req.user.id, dto);
  }

  @Post(':id/suspend')
  suspendStore(@Param('id') id: string, @Req() req: any, @Body() dto: SuspendStoreDto) {
    return this.storesService.adminSuspendStore(id, req.user.sub ?? req.user.id, dto);
  }

  @Patch(':id/plan')
  assignPlan(@Param('id') id: string, @Body() dto: AssignPlanDto) {
    return this.storesService.adminAssignPlan(id, dto.planId);
  }
}

// ─── Seller Plans sub-controller (re-uses AdminController pattern) ────────────

@AdminController('plans')
export class AdminPlansController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  listPlans() {
    return this.storesService.getSellerPlans();
  }

  @Post()
  createPlan(@Body() dto: CreateSellerPlanDto) {
    return this.storesService.createSellerPlan(dto);
  }

  @Patch(':id')
  updatePlan(@Param('id') id: string, @Body() dto: UpdateSellerPlanDto) {
    return this.storesService.updateSellerPlan(id, dto);
  }

  @Delete(':id')
  deletePlan(@Param('id') id: string) {
    return this.storesService.deleteSellerPlan(id);
  }
}

// ─── Platform Settings sub-controller ────────────────────────────────────────

@AdminController('platform-settings')
export class AdminPlatformSettingsController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  getSettings() {
    return this.storesService.getPlatformSettings();
  }

  @Patch()
  updateSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.storesService.updatePlatformSettings(dto);
  }
}

// ─── Seller Payouts sub-controller ───────────────────────────────────────────

@AdminController('seller-payouts')
export class AdminSellerPayoutsController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  listPayouts(
    @Query('page')   page?: string,
    @Query('limit')  limit?: string,
    @Query('status') status?: string,
  ) {
    return this.storesService.adminListPayouts({
      page:   page  ? +page  : undefined,
      limit:  limit ? +limit : undefined,
      status,
    });
  }

  @Post(':id/pay')
  markPaid(@Param('id') id: string, @Req() req: any, @Body() dto: MarkPayoutPaidDto) {
    return this.storesService.adminMarkPayoutPaid(id, req.user.sub ?? req.user.id, dto);
  }
}

// ─── Finance Stats sub-controller ────────────────────────────────────────────

@AdminController('finance')
export class AdminFinanceController {
  constructor(private readonly storesService: StoresService) {}

  @Get('stats')
  getStats() {
    return this.storesService.getFinanceStats();
  }
}
