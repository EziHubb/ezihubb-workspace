import {
  BadRequestException,
  Body,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { PdfService } from '../pdf/pdf.service';
import { LabelService } from '../shipping/label.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AddTrackingDto } from './dto/add-tracking.dto';
import { MarkShippedDto } from './dto/mark-shipped.dto';
import { AdminOrderQueryDto } from './dto/order-list-item.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AdminController } from '../../common/decorators/admin-controller.decorator';

@AdminController('orders')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly pdfService:    PdfService,
    private readonly labelService:  LabelService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all orders (filterable)' })
  async findAll(@Query() query: AdminOrderQueryDto) {
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
  async bulkPackingSlips(@Body('orderIds') orderIds: string[]) {
    const urls = await Promise.all(orderIds.map((id) => this.pdfService.generatePackingSlip(id)));
    return { urls };
  }

  // ── CSV export (literal route — must come before :id) ──────────────────────

  @Get('export')
  @ApiOperation({ summary: 'Export orders as CSV' })
  async exportCsv(@Query() query: AdminOrderQueryDto, @Res() res: Response) {
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
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.updateStatus(id, dto, user.sub);
  }

  @Patch(':id/tracking')
  @ApiOperation({ summary: 'Add tracking information' })
  async addTracking(@Param('id') id: string, @Body() dto: AddTrackingDto) {
    return this.ordersService.addTracking(id, dto);
  }

  @Patch(':id/ship')
  @ApiOperation({ summary: 'Mark order as shipped — sets SHIPPED status, saves tracking, registers EasyPost tracker, emails customer' })
  async markShipped(
    @Param('id') id: string,
    @Body() dto: MarkShippedDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.markShipped(id, dto, user.sub);
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
}
