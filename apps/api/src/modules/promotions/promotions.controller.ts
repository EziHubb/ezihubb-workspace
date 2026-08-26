import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, UpdatePromotionDto , PatchPromotionDto } from './dto/create-promotion.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import {
  CouponValidationResultDto,
  PromotionResponseDto,
  PromotionStatsDto,
} from './dto/promotion-response.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { PromotionQueryDto } from './dto/promotion-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Role } from '@ezihubb/constants';
import { StoreContextService } from '../../common/services/store-context.service';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly storeContext: StoreContextService,
  ) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  @Post('validate')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: 'Validate a coupon code (does not consume it)' })
  async validateCoupon(
    @Body() dto: ValidateCouponDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<CouponValidationResultDto> {
    return this.promotionsService.validateCoupon(dto, user?.sub);
  }

  // ── Admin ────────────────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a promotion/coupon' })
  async create(@Req() req: Request, @Body() dto: CreatePromotionDto): Promise<PromotionResponseDto> {
    const context = await this.storeContext.resolve(req);
    // A scoped caller (plain ADMIN, or SUPER_ADMIN in "My Store") always creates under
    // their own store — dto.storeId is ignored for them, so this can't be used for IDOR.
    // A platform-context SUPER_ADMIN may target a specific store via dto.storeId, or
    // leave it unset to create a platform-wide coupon (valid across every store).
    const targetStoreId = context.isPlatformContext ? dto.storeId : (context.storeId ?? undefined);
    return this.promotionsService.create(dto, targetStoreId);
  }

  @Get('page-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get aggregate stats for the promotions dashboard page' })
  async getPageStats(@Req() req: Request) {
    const context = await this.storeContext.resolve(req);
    return this.promotionsService.getPageStats(context.storeId ?? undefined);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all promotions (admin)' })
  async findAll(@Req() req: Request, @Query() query: PromotionQueryDto): Promise<PaginatedResult<PromotionResponseDto>> {
    const context = await this.storeContext.resolve(req);
    return this.promotionsService.findAll(query, context.storeId ?? undefined);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a promotion by ID' })
  async findOne(@Req() req: Request, @Param('id') id: string): Promise<PromotionResponseDto> {
    const context = await this.storeContext.resolve(req);
    return this.promotionsService.findOne(id, context.storeId ?? undefined);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a promotion' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    const context = await this.storeContext.resolve(req);
    return this.promotionsService.update(id, dto, context.storeId ?? undefined);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Partially update a promotion (including isActive toggle)' })
  async patch(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PatchPromotionDto,
  ): Promise<PromotionResponseDto> {
    const context = await this.storeContext.resolve(req);
    return this.promotionsService.patch(id, dto, context.storeId ?? undefined);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a promotion' })
  async remove(@Req() req: Request, @Param('id') id: string): Promise<void> {
    const context = await this.storeContext.resolve(req);
    return this.promotionsService.remove(id, context.storeId ?? undefined);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a promotion' })
  async deactivate(@Req() req: Request, @Param('id') id: string): Promise<PromotionResponseDto> {
    const context = await this.storeContext.resolve(req);
    return this.promotionsService.deactivate(id, context.storeId ?? undefined);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get usage statistics for a promotion' })
  async getStats(@Req() req: Request, @Param('id') id: string): Promise<PromotionStatsDto> {
    const context = await this.storeContext.resolve(req);
    return this.promotionsService.getStats(id, context.storeId ?? undefined);
  }
}
