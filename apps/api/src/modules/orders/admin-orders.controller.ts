import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AddTrackingDto } from './dto/add-tracking.dto';
import { AdminOrderQueryDto } from './dto/order-list-item.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Role } from '@mlh/constants';

@ApiTags('Admin — Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List all orders (filterable)' })
  async findAll(@Query() query: AdminOrderQueryDto) {
    return this.ordersService.findAll(query);
  }

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
}
