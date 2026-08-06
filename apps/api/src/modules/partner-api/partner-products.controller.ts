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
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Store } from '@prisma/client';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyThrottlerGuard } from '../../common/guards/api-key-throttler.guard';
import { ProductsService } from '../products/products.service';
import { ProductQueryDto } from '../products/dto/product-query.dto';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';

@Controller('partner/products')
@UseGuards(ApiKeyGuard, ApiKeyThrottlerGuard)
@ApiSecurity('apiKey')
@ApiTags('Partner API - Products')
export class PartnerProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products in your store' })
  async list(
    @Req() req: Request & { store: Store },
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.findAll({
      ...query,
      storeId: req.store.id,
      includeInactive: true,
    } as Parameters<typeof this.productsService.findAll>[0]);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a product by ID' })
  async findOne(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
  ) {
    return this.productsService.findByIdForStore(id, req.store.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new product in your store' })
  async create(
    @Req() req: Request & { store: Store },
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(dto, req.store.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  async update(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    await this.productsService.findByIdForStore(id, req.store.id);
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (soft) a product' })
  async remove(
    @Req() req: Request & { store: Store },
    @Param('id') id: string,
  ) {
    await this.productsService.deleteForStore(id, req.store.id);
  }
}
