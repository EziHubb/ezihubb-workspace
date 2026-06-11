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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IsOptional, IsString, IsBoolean, IsNumber, IsPositive } from 'class-validator';
import { ProductsService } from './products.service';
import { ShippingService } from '../shipping/shipping.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StoreOwnerGuard } from '../stores/guards/store-owner.guard';
import { Store } from '@prisma/client';

// ── DTOs ─────────────────────────────────────────────────────────────────────

class SellerProductQueryDto {
  @ApiPropertyOptional() @IsOptional() page?: number;
  @ApiPropertyOptional() @IsOptional() limit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
}

class SellerCreateProductDto {
  @IsString() name: string;
  @IsString() description: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsNumber() @IsPositive() basePrice: number;
  @IsOptional() @IsNumber() compareAtPrice?: number;
  @IsString() categoryId: string;
  @IsString() sku: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsNumber() processingDays?: number;
}

class SellerUpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsOptional() @IsNumber() basePrice?: number;
  @IsOptional() @IsNumber() compareAtPrice?: number;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsNumber() processingDays?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() shippingProfileId?: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller('seller/products')
@UseGuards(JwtAuthGuard, StoreOwnerGuard)
@ApiBearerAuth()
@ApiTags('Seller - Products')
export class SellerProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly shippingService: ShippingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List seller products (scoped to store)' })
  async listProducts(
    @Req() req: Request & { store: Store },
    @Query() query: SellerProductQueryDto,
  ) {
    return this.productsService.findAll({
      ...query,
      storeId: req.store.id,
      includeInactive: true,
    } as Parameters<typeof this.productsService.findAll>[0]);
  }

  @Post('draft')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create draft product in seller store' })
  async createDraft(@Req() req: Request & { store: Store }) {
    return this.productsService.createDraftForStore(req.store.id);
  }

  @Get('shipping-profiles')
  @ApiOperation({ summary: 'Get shipping profiles for this store' })
  async getShippingProfiles(@Req() req: Request & { store: Store }) {
    return this.shippingService.getShippingProfilesForStore(req.store.id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get categories available for seller products' })
  async getCategories() {
    return this.productsService.getSellerCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get seller product by ID' })
  async getProduct(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
  ) {
    return this.productsService.findByIdForStore(id, req.store.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update seller product' })
  async updateProduct(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Body() dto: SellerUpdateProductDto,
  ) {
    return this.productsService.updateForStore(id, req.store.id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle product active status' })
  async toggleStatus(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.productsService.updateForStore(id, req.store.id, { isActive });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete seller product' })
  async deleteProduct(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
  ) {
    return this.productsService.deleteForStore(id, req.store.id);
  }
}
