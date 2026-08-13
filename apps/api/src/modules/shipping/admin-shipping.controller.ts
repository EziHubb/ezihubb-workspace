import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import {
  CreateProcessingProfileDto,
  UpdateProcessingProfileDto,
  ProcessingScheduleDto,
  DeliveryUpgradesDto,
} from './dto/processing-profile.dto';
import { ShippingProfileDto } from './dto/shipping-profile.dto';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';

@AdminController('shipping')
export class AdminShippingController {

  constructor(
    private readonly shippingService: ShippingService,
    private readonly storeContext: StoreContextService,
  ) {}

  // ── Processing profiles ───────────────────────────────────────────────────────
  // Seller-owned (Etsy: Delivery settings → Your processing profiles) — always
  // scoped to the caller's own store. A platform-context SUPER_ADMIN has no
  // store to own these against, so requireStoreId() 400s them rather than
  // silently creating an orphaned platform-wide profile.

  @Get('processing-profiles')
  @ApiOperation({ summary: 'List all processing profiles (scoped to own store for shop owners)' })
  async getProcessingProfiles(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    if (context.storeId) return this.shippingService.getProcessingProfilesForStore(context.storeId);
    return this.shippingService.getProcessingProfiles();
  }

  @Post('processing-profiles')
  @ApiOperation({ summary: '[Seller] Create a processing profile for the caller\'s own store' })
  async createProcessingProfile(@Req() req: Request, @Body() dto: CreateProcessingProfileDto) {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.createProcessingProfile(storeId, dto);
  }

  @Patch('processing-profiles/:id')
  @ApiOperation({ summary: '[Seller] Update a processing profile owned by the caller\'s own store' })
  async updateProcessingProfile(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateProcessingProfileDto) {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.updateProcessingProfile(storeId, id, dto);
  }

  @Delete('processing-profiles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Seller] Delete a processing profile — blocked while any listing still uses it' })
  async deleteProcessingProfile(@Req() req: Request, @Param('id') id: string): Promise<void> {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.deleteProcessingProfile(storeId, id);
  }

  // ── Order processing schedule (Etsy: Delivery settings → Order processing schedule) ──

  @Get('processing-schedule')
  @ApiOperation({ summary: "[Seller] Get the caller's own store's order processing schedule" })
  async getProcessingSchedule(@Req() req: Request) {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.getProcessingSchedule(storeId);
  }

  @Patch('processing-schedule')
  @ApiOperation({ summary: "[Seller] Update the caller's own store's order processing schedule" })
  async updateProcessingSchedule(@Req() req: Request, @Body() dto: ProcessingScheduleDto) {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.updateProcessingSchedule(storeId, dto);
  }

  // ── Delivery upgrades (Etsy: Delivery settings → Upgrades) ────────────────────

  @Get('delivery-upgrades')
  @ApiOperation({ summary: "[Seller] Get whether the caller's own store has paid delivery upgrades enabled" })
  async getDeliveryUpgradesEnabled(@Req() req: Request) {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.getDeliveryUpgradesEnabled(storeId);
  }

  @Patch('delivery-upgrades')
  @ApiOperation({ summary: "[Seller] Enable/disable paid delivery upgrades for the caller's own store" })
  async updateDeliveryUpgradesEnabled(@Req() req: Request, @Body() dto: DeliveryUpgradesDto) {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.updateDeliveryUpgradesEnabled(storeId, dto);
  }

  // ── Shipping (delivery) profiles ──────────────────────────────────────────────
  // Seller-owned (Etsy: Delivery settings → Delivery profiles) — same
  // own-store-only scoping as processing profiles above.

  @Get('profiles')
  @ApiOperation({ summary: 'List all shipping profiles with their methods (scoped to own store for shop owners)' })
  async getShippingProfiles(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    if (context.storeId) return this.shippingService.getShippingProfilesForStore(context.storeId);
    return this.shippingService.getShippingProfiles();
  }

  @Post('profiles')
  @ApiOperation({ summary: "[Seller] Create a delivery profile for the caller's own store" })
  async createShippingProfile(@Req() req: Request, @Body() dto: ShippingProfileDto) {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.createShippingProfile(storeId, dto);
  }

  @Patch('profiles/:id')
  @ApiOperation({ summary: "[Seller] Replace a delivery profile's destinations owned by the caller's own store" })
  async updateShippingProfile(@Req() req: Request, @Param('id') id: string, @Body() dto: ShippingProfileDto) {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.updateShippingProfile(storeId, id, dto);
  }

  @Delete('profiles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[Seller] Delete a delivery profile — blocked while any listing still uses it' })
  async deleteShippingProfile(@Req() req: Request, @Param('id') id: string): Promise<void> {
    const storeId = this.storeContext.requireStoreId(await this.storeContext.resolve(req));
    return this.shippingService.deleteShippingProfile(storeId, id);
  }
}
