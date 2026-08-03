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
import { CreatePromotionDto, UpdatePromotionDto } from './dto/create-promotion.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import {
  CouponValidationResultDto,
  PromotionResponseDto,
  PromotionStatsDto,
} from './dto/promotion-response.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Role } from '@ezihubb/constants';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtLike { sub?: string; id?: string; role?: string }

async function resolveSellerStoreId(prisma: PrismaService, user: JwtLike): Promise<string | null> {
  if (user.role === 'SUPER_ADMIN') return null;
  const userId = user.sub ?? user.id;
  if (!userId) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { storeId: true } });
  return dbUser?.storeId ?? null;
}

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly prisma: PrismaService,
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
  async create(@Body() dto: CreatePromotionDto): Promise<PromotionResponseDto> {
    return this.promotionsService.create(dto);
  }

  @Get('page-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get aggregate stats for the promotions dashboard page' })
  async getPageStats() {
    return this.promotionsService.getPageStats();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all promotions (admin)' })
  async findAll(@Req() req: Request, @Query() query: PaginationDto): Promise<PaginatedResult<PromotionResponseDto>> {
    const storeId = await resolveSellerStoreId(this.prisma, req.user as JwtLike);
    return this.promotionsService.findAll(query, storeId ?? undefined);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a promotion by ID' })
  async findOne(@Param('id') id: string): Promise<PromotionResponseDto> {
    return this.promotionsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a promotion' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    return this.promotionsService.update(id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Partially update a promotion (including isActive toggle)' })
  async patch(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto & { isActive?: boolean },
  ): Promise<PromotionResponseDto> {
    return this.promotionsService.patch(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a promotion' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.promotionsService.remove(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a promotion' })
  async deactivate(@Param('id') id: string): Promise<PromotionResponseDto> {
    return this.promotionsService.deactivate(id);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get usage statistics for a promotion' })
  async getStats(@Param('id') id: string): Promise<PromotionStatsDto> {
    return this.promotionsService.getStats(id);
  }
}
