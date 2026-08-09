import {
  Get, Post, Patch, Delete, Body, Param, Query, Req,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoresService } from './stores.service';
import { AuditLogService } from '../../common/services/audit-log.service';

class AdminUpdateStoreDto {
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsUrl()
  bannerUrl?: string;

  @IsOptional() @IsUrl()
  logoUrl?: string;
}

export class MarkPayoutPaidDto {
  paymentMethod: string;
  @IsOptional() @IsString() paymentDetail?: string;
  @IsOptional() @IsString() adminNotes?: string;
}
import {
  ApproveStoreDto, RejectStoreDto, SuspendStoreDto,
  AdminListStoresDto, UpdatePlatformSettingsDto,
} from './dto/admin-stores.dto';

@AdminController('stores')
export class AdminStoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly auditLog:      AuditLogService,
  ) {}

  private logStoreDecision(req: any, id: string, action: string, dto?: Record<string, unknown>): void {
    this.auditLog.log({
      userId:     req.user.sub ?? req.user.id,
      action,
      entityType: 'Store',
      entityId:   id,
      after:      dto,
      ip:         req.ip,
      userAgent:  req.headers?.['user-agent'],
    });
  }

  @Get()
  listStores(@Query() dto: AdminListStoresDto, @Req() req: any) {
    const isShopOwner = req.user?.role === 'ADMIN';
    const scopedOwnerId = isShopOwner ? (req.user?.sub ?? req.user?.id) : undefined;
    return this.storesService.adminListStores(dto, scopedOwnerId);
  }

  @Get(':id')
  getStore(@Param('id') id: string, @Req() req: any) {
    const isShopOwner = req.user?.role === 'ADMIN';
    const scopedOwnerId = isShopOwner ? (req.user?.sub ?? req.user?.id) : undefined;
    return this.storesService.adminGetStore(id, scopedOwnerId);
  }

  @Post(':id/approve')
  async approveStore(@Param('id') id: string, @Req() req: any, @Body() dto: ApproveStoreDto) {
    const result = await this.storesService.adminApproveStore(id, req.user.sub ?? req.user.id, dto);
    this.logStoreDecision(req, id, 'APPROVE', dto as unknown as Record<string, unknown>);
    return result;
  }

  @Post(':id/reject')
  async rejectStore(@Param('id') id: string, @Req() req: any, @Body() dto: RejectStoreDto) {
    const result = await this.storesService.adminRejectStore(id, req.user.sub ?? req.user.id, dto);
    this.logStoreDecision(req, id, 'REJECT', dto as unknown as Record<string, unknown>);
    return result;
  }

  @Post(':id/suspend')
  async suspendStore(@Param('id') id: string, @Req() req: any, @Body() dto: SuspendStoreDto) {
    const result = await this.storesService.adminSuspendStore(id, req.user.sub ?? req.user.id, dto);
    this.logStoreDecision(req, id, 'SUSPEND', dto as unknown as Record<string, unknown>);
    return result;
  }

  @Patch(':id')
  updateStore(@Param('id') id: string, @Body() dto: AdminUpdateStoreDto) {
    return this.storesService.adminUpdateStore(id, dto);
  }

  @Post(':id/banner')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadBanner(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException({ code: 'ERR_FILE_REQUIRED', message: 'file is required' });
    return this.storesService.adminUploadStoreBanner(id, file);
  }

  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException({ code: 'ERR_FILE_REQUIRED', message: 'file is required' });
    return this.storesService.adminUploadStoreLogo(id, file);
  }

  @Get(':id/products')
  getStoreProducts(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storesService.adminGetStoreProducts(id, { page: page ? +page : 1, limit: limit ? +limit : 20 });
  }

  @Get(':id/orders')
  getStoreOrders(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storesService.adminGetStoreOrders(id, { page: page ? +page : 1, limit: limit ? +limit : 20 });
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

  @Get('stats')
  getPayoutStats() {
    return this.storesService.adminPayoutStats();
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

  @Get('chart')
  getChart(@Query('days') days?: string) {
    return this.storesService.getFinanceChart(days ? +days : 30);
  }

  @Get('stores')
  getStoreFinance(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storesService.getStoreFinanceList({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
    });
  }
}
