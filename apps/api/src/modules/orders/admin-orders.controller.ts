import {
  BadRequestException,
  Body,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OrdersService } from './orders.service';
import { PdfService } from '../pdf/pdf.service';
import { LabelService } from '../shipping/label.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AddTrackingDto } from './dto/add-tracking.dto';
import { MarkShippedDto } from './dto/mark-shipped.dto';
import { AdminOrderQueryDto } from './dto/order-list-item.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AdminController } from '../../common/decorators/admin-controller.decorator';
import { StoreContextService } from '../../common/services/store-context.service';
import { OrderOwnershipGuard } from '../../common/guards/order-ownership.guard';
import { PrismaService } from '../../prisma/prisma.service';

// See the matching comment in admin-products.controller.ts — must stay
// above @AdminController so JwtAuthGuard/RolesGuard run before this guard.
@UseGuards(OrderOwnershipGuard)
@AdminController('orders')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly pdfService:    PdfService,
    private readonly labelService:  LabelService,
    private readonly auditLog:      AuditLogService,
    private readonly storeContext:  StoreContextService,
    private readonly prisma:        PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List orders (scoped to own store for shop owners)' })
  async findAll(@Req() req: Request, @Query() query: AdminOrderQueryDto) {
    const context = await this.storeContext.resolve(req);
    if (context.storeId) query.storeId = context.storeId;
    return this.ordersService.findAll(query);
  }

  // ── PDF endpoints — two-segment routes BEFORE :id to avoid param conflicts ─

  @Get(':id/invoice')
  @ApiOperation({ summary: 'Generate (or return cached) full invoice PDF for an order' })
  async getInvoice(@Param('id') id: string) {
    const url = await this.pdfService.generateInvoice(id, false);
    return { url };
  }

  @Get(':id/packing-slip')
  @ApiOperation({ summary: 'Generate (or return cached) packing slip PDF for an order' })
  async getPackingSlip(@Param('id') id: string) {
    const url = await this.pdfService.generatePackingSlip(id);
    return { url };
  }

  @Post('bulk-packing-slips')
  @ApiOperation({ summary: 'Generate packing slips for multiple orders — returns array of URLs' })
  async bulkPackingSlips(@Req() req: Request, @Body('orderIds') orderIds: string[]) {
    // Silently drop any order the caller isn't a vendor on — OrderOwnershipGuard
    // only checks the single :id route param, not an array inside the body.
    const context = await this.storeContext.resolve(req);
    const allowedIds = context.isPlatformContext
      ? orderIds
      : (await this.prisma.storeOrder.findMany({
          where: { orderId: { in: orderIds }, storeId: context.storeId! },
          select: { orderId: true },
        })).map((so) => so.orderId);

    const urls = await Promise.all(allowedIds.map((id) => this.pdfService.generatePackingSlip(id)));
    return { urls };
  }

  // ── CSV export (literal route — must come before :id) ──────────────────────

  @Get('export')
  @ApiOperation({ summary: 'Export orders as CSV' })
  async exportCsv(@Req() req: Request, @Query() query: AdminOrderQueryDto, @Res() res: Response) {
    const context = await this.storeContext.resolve(req);
    if (context.storeId) query.storeId = context.storeId;
    const csv = await this.ordersService.exportOrdersCsv(query);
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', `attachment; filename="orders-${Date.now()}.csv"`);
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order detail by ID' })
  async findOne(@Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status' })
  async updateStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.ordersService.updateStatus(id, dto, user.sub);
    this.auditLog.log({
      userId:     user.sub,
      action:     'UPDATE',
      entityType: 'Order',
      entityId:   id,
      after:      dto as unknown as Record<string, unknown>,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
    return result;
  }

  @Patch(':id/tracking')
  @ApiOperation({ summary: 'Add tracking information' })
  async addTracking(@Param('id') id: string, @Body() dto: AddTrackingDto) {
    return this.ordersService.addTracking(id, dto);
  }

  @Patch(':id/ship')
  @ApiOperation({ summary: 'Mark order as shipped — sets SHIPPED status, saves tracking, registers EasyPost tracker, emails customer' })
  async markShipped(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: MarkShippedDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // The caller's shop, so the dispatch lands on THEIR row rather than on
    // every vendor in the basket. Null for a platform-context SUPER_ADMIN,
    // who has no shop of their own.
    const context = await this.storeContext.resolve(req);
    const result = await this.ordersService.markShipped(
      id, dto, user.sub, context.isPlatformContext ? null : context.storeId ?? null,
    );
    this.auditLog.log({
      userId:     user.sub,
      action:     'SHIP',
      entityType: 'Order',
      entityId:   id,
      after:      dto as unknown as Record<string, unknown>,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
    return result;
  }

  // ── Label purchase (EasyPost) ───────────────────────────────────────────────

  @Get(':id/rates')
  @ApiOperation({ summary: 'Get EasyPost shipping rates for an order (safe — no charge)' })
  async getShippingRates(@Param('id') id: string) {
    return this.labelService.getRates(id);
  }

  @Post(':id/buy-label')
  @ApiOperation({ summary: 'Purchase EasyPost shipping label — irreversible, charges immediately' })
  async buyLabel(
    @Param('id') id: string,
    @Body('rateId') rateId: string,
  ) {
    if (!rateId) throw new BadRequestException('rateId is required');
    return this.labelService.purchaseLabel(id, rateId);
  }

  @Post(':id/note')
  @ApiOperation({ summary: 'Add or update private admin note on order' })
  async addNote(
    @Param('id') id: string,
    @Body('note') note: string,
  ) {
    await this.ordersService.addAdminNote(id, note ?? '');
    return { success: true };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Admin-cancel an order (no time-window restriction)' })
  async adminCancelOrder(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.ordersService.adminCancelOrder(id, reason ?? 'Cancelled by admin', user.sub);
    this.auditLog.log({
      userId:     user.sub,
      action:     'CANCEL',
      entityType: 'Order',
      entityId:   id,
      after:      { reason } as Record<string, unknown>,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
    return result;
  }

  // GET :id/earnings is gone. It was Order-scoped behind a guard that only
  // checks the caller is one of the order's vendors, so a split basket showed
  // one shop another shop's money — see the note in orders.service.ts.
  // The seller-facing replacement is
  // GET /admin/order-progress/orders/:storeOrderId/earnings.
}
