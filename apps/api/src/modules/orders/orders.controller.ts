import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { PdfService } from '../pdf/pdf.service';
import { CheckoutDto, CancelOrderDto } from './dto/checkout.dto';
import { TaxPreviewDto } from '../tax/dto/tax-preview.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly pdfService:    PdfService,
  ) {}

  @Post('tax-preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview tax for a shipping address + cart total (US only)' })
  async previewTax(@Body() dto: TaxPreviewDto) {
    return this.ordersService.previewTax({
      postalCode:   dto.postalCode,
      state:        dto.state,
      country:      dto.country,
      subtotal:     dto.subtotal,
      shippingCost: dto.shippingCost,
    });
  }

  @Post()
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Checkout — create an order from cart' })
  async checkout(
    @Body() dto: CheckoutDto,
    @CurrentUser() user: JwtPayload | undefined,
    @Req() req: Request,
  ) {
    const sessionId = req.cookies?.['cart_session'] as string | undefined;
    const cookies   = req.cookies as Record<string, string>;
    return this.ordersService.checkout(dto, user?.sub, sessionId, cookies);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my orders' })
  async getMyOrders(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.ordersService.findMyOrders(user.sub, pagination);
  }

  @Get('me/:orderNumber')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my order detail' })
  async getMyOrder(@CurrentUser() user: JwtPayload, @Param('orderNumber') orderNumber: string) {
    return this.ordersService.findMyOrderByNumber(user.sub, orderNumber);
  }

  // ── PDF ────────────────────────────────────────────────────────────────────
  // Two-segment routes (:id/invoice) declared before one-segment (:orderNumber)
  // to prevent NestJS from greedily matching the literal 'invoice' as an orderNumber.

  @Get(':id/invoice')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download invoice PDF for own order (auto-detects gift receipt to hide prices)' })
  async getInvoice(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // PdfService verifies ownership via userId and auto-detects giftReceipt flag
    const url = await this.pdfService.generateInvoice(id, undefined, user.sub);
    return { url };
  }

  @Get('track')
  @ApiOperation({ summary: 'Track a guest order by order number + email' })
  @ApiQuery({ name: 'orderNumber', required: true })
  @ApiQuery({ name: 'email', required: true })
  async trackGuestOrder(
    @Query('orderNumber') orderNumber: string,
    @Query('email') email: string,
  ) {
    return this.ordersService.findGuestOrder(orderNumber, email);
  }

  @Get(':orderNumber')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Get order detail — authenticated users by userId, guests by email query param' })
  @ApiQuery({ name: 'email', required: false })
  async getOrderDetail(
    @Param('orderNumber') orderNumber: string,
    @Query('email') email: string,
    @CurrentUser() user: JwtPayload | undefined,
  ) {
    if (user) return this.ordersService.findMyOrderByNumber(user.sub, orderNumber);
    return this.ordersService.findGuestOrder(orderNumber, email);
  }

  @Post(':orderNumber/cancel')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel order within 2h of confirmation' })
  async cancelOrder(
    @Param('orderNumber') orderNumber: string,
    @CurrentUser() user: JwtPayload | undefined,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(orderNumber, user?.sub, dto.reason, dto.guestEmail);
  }
}
