import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShippingService, ZoneWithMethods } from './shipping.service';
import {
  CreateShippingZoneDto,
  UpdateShippingZoneDto,
} from './dto/create-shipping-zone.dto';
import {
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
} from './dto/create-shipping-method.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@mlh/constants';
import { ShippingMethod } from '@prisma/client';

@ApiTags('admin / shipping')
@Controller('admin/shipping')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  // ── Zones ────────────────────────────────────────────────────────────────────

  @Get('zones')
  @ApiOperation({ summary: 'List all shipping zones with their methods' })
  async getZones(): Promise<ZoneWithMethods[]> {
    return this.shippingService.getZones();
  }

  @Get('zones/:id')
  @ApiOperation({ summary: 'Get a shipping zone by ID' })
  async getZone(@Param('id') id: string): Promise<ZoneWithMethods> {
    return this.shippingService.getZoneById(id);
  }

  @Post('zones')
  @ApiOperation({ summary: 'Create a shipping zone' })
  async createZone(@Body() dto: CreateShippingZoneDto): Promise<ZoneWithMethods> {
    return this.shippingService.createZone(dto);
  }

  @Put('zones/:id')
  @ApiOperation({ summary: 'Update a shipping zone' })
  async updateZone(
    @Param('id') id: string,
    @Body() dto: UpdateShippingZoneDto,
  ): Promise<ZoneWithMethods> {
    return this.shippingService.updateZone(id, dto);
  }

  @Delete('zones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shipping zone and all its methods' })
  async deleteZone(@Param('id') id: string): Promise<void> {
    return this.shippingService.deleteZone(id);
  }

  // ── Methods ──────────────────────────────────────────────────────────────────

  @Get('zones/:zoneId/methods')
  @ApiOperation({ summary: 'List methods for a shipping zone' })
  async getMethodsByZone(@Param('zoneId') zoneId: string): Promise<ShippingMethod[]> {
    return this.shippingService.getMethodsByZone(zoneId);
  }

  @Post('zones/:zoneId/methods')
  @ApiOperation({ summary: 'Add a shipping method to a zone' })
  async createMethod(
    @Param('zoneId') zoneId: string,
    @Body() dto: CreateShippingMethodDto,
  ): Promise<ShippingMethod> {
    return this.shippingService.createMethod(zoneId, dto);
  }

  @Put('methods/:id')
  @ApiOperation({ summary: 'Update a shipping method' })
  async updateMethod(
    @Param('id') id: string,
    @Body() dto: UpdateShippingMethodDto,
  ): Promise<ShippingMethod> {
    return this.shippingService.updateMethod(id, dto);
  }

  @Delete('methods/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a shipping method' })
  async deleteMethod(@Param('id') id: string): Promise<void> {
    return this.shippingService.deleteMethod(id);
  }
}
