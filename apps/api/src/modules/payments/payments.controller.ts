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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { PaypalService } from './paypal.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { PurchaseGiftCardDto } from './dto/purchase-gift-card.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@ezihubb/constants';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { AuditLogService } from '../../common/services/audit-log.service';

class PaypalCreateOrderDto {
  @IsString() @IsNotEmpty()
  orderId: string;

  @IsString() @IsOptional() @IsUrl()
  returnUrl?: string;

  @IsString() @IsOptional() @IsUrl()
  cancelUrl?: string;
}

class PaypalCaptureDto {
  @IsString() @IsNotEmpty()
  paypalOrderId: string;
}

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paypalService:   PaypalService,
    private readonly auditLog:        AuditLogService,
  ) {}

  @Post('create-intent')
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent for an order' })
  async createIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(dto);
  }

  // ─── PayPal ──────────────────────────────────────────────────────────────────

  @Post('paypal/create-order')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a PayPal order for checkout — returns paypalOrderId for JS SDK' })
  async paypalCreateOrder(@Body() dto: PaypalCreateOrderDto) {
    return this.paypalService.createOrder(dto.orderId, dto.returnUrl, dto.cancelUrl);
  }

  @Post('paypal/capture')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Capture a PayPal order after the payer approves it' })
  async paypalCapture(@Body() dto: PaypalCaptureDto) {
    await this.paypalService.captureOrder(dto.paypalOrderId);
    return { captured: true };
  }

  @Post('gift-cards/purchase')
  @UseGuards(OptionalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Purchase a gift card (Stripe payment → gift card code emailed to recipient)' })
  async purchaseGiftCard(
    @Body() dto: PurchaseGiftCardDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.paymentsService.purchaseGiftCard(dto, user?.sub);
  }

  @Get('gift-cards/:code/validate')
  @ApiOperation({ summary: 'Validate a gift card and check balance' })
  async validateGiftCard(@Param('code') code: string) {
    return this.paymentsService.validateGiftCard(code);
  }

  @Post('gift-cards/:code/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Apply a gift card to an order. Fully pays if balance covers total; otherwise deducts partial amount.' })
  async applyGiftCard(
    @Param('code') code: string,
    @Body('orderId') orderId: string,
  ) {
    return this.paymentsService.applyGiftCard(code, orderId);
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  // Platform-wide payments/refunds, no store scoping — SUPER_ADMIN-only.
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Aggregate payment stats for dashboard (admin)' })
  async getStats() {
    return this.paymentsService.getStats();
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  // Platform-wide payments/refunds, no store scoping — SUPER_ADMIN-only.
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all payments (admin)' })
  async listPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.listPayments(
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get(':id/refunds')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  // Platform-wide payments/refunds, no store scoping — SUPER_ADMIN-only.
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get refund details for a payment (admin)' })
  async getRefunds(@Param('id') id: string) {
    return this.paymentsService.getRefunds(id);
  }

  @Post(':id/refund')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  // Platform-wide payments/refunds, no store scoping — SUPER_ADMIN-only.
  @Roles(Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a refund (admin)' })
  async createRefund(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = await this.paymentsService.createRefund(id, dto);
    this.auditLog.log({
      userId:     user.sub,
      action:     'REFUND',
      entityType: 'Payment',
      entityId:   id,
      after:      dto as unknown as Record<string, unknown>,
      ip:         req.ip,
      userAgent:  req.headers['user-agent'],
    });
    return result;
  }
}
