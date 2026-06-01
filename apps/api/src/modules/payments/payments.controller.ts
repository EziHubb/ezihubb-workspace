import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @ApiOperation({ summary: 'Create a Stripe PaymentIntent for an order' })
  async createIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(dto);
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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Aggregate payment stats for dashboard (admin)' })
  async getStats() {
    return this.paymentsService.getStats();
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get refund details for a payment (admin)' })
  async getRefunds(@Param('id') id: string) {
    return this.paymentsService.getRefunds(id);
  }

  @Post(':id/refund')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a refund (admin)' })
  async createRefund(@Param('id') id: string, @Body() dto: CreateRefundDto) {
    return this.paymentsService.createRefund(id, dto);
  }
}
