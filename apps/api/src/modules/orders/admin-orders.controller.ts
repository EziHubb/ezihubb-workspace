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
import { PrismaService } from '../../prisma/prisma.service';

interface JwtLike { sub?: string; id?: string; role?: string }

async function resolveSellerStoreId(prisma: PrismaService, user: JwtLike): Promise<string | null> {
  if (user.role === 'SUPER_ADMIN') return null;
  const userId = user.sub ?? user.id;
  if (!userId) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { storeId: true } });
  return dbUser?.storeId ?? null;
}

@AdminController('orders')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly pdfService:    PdfService,
    private readonly labelService:  LabelService,
    private readonly auditLog:      AuditLogService,
    private readonly prisma:        PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List orders (scoped to own store for shop owners)' })
  async findAll(@Req() req: Request, @Query() query: AdminOrderQueryDto) {
    const storeId = await resolveSellerStoreId(this.prisma, req.user as JwtLike);
    return this.ordersService.findAll(storeId ? { ...query, storeId } : query);
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
  async bulkPackingSlips(@Body('orderIds') orderIds: string[]) {
    const urls = await Promise.all(orderIds.map((id) => this.pdfService.generatePackingSlip(id)));
    return { urls };
  }

  // ── CSV export (literal route — must come before :id) ──────────────────────

  @Get('export')
  @ApiOperation({ summary: 'Export orders as CSV' })
  async exportCsv(@Req() req: Request, @Query() query: AdminOrderQueryDto, @Res() res: Response) {
    const storeId = await resolveSellerStoreId(this.prisma, req.user as JwtLike);
    const csv = await this.ordersService.exportOrdersCsv(storeId ? { ...query, storeId } : query);
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
    const result = await this.ordersService.markShipped(id, dto, user.sub);
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

  @Get(':id/earnings')
  @ApiOperation({ summary: 'Get earnings breakdown for an order (fees, net earnings)' })
  async getEarnings(@Param('id') id: string) {
    return this.ordersService.getEarnings(id);
  }
}
