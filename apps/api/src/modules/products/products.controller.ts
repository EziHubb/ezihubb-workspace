import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductListItemDto } from './dto/product-list-item.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';

@ApiTags('Products')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // GET /products
  @Get()
  @ApiOperation({ summary: 'List products with filters, sorting, and pagination' })
  @ApiResponse({ status: 200, type: [ProductListItemDto] })
  findAll(@Query() query: ProductQueryDto): Promise<PaginatedResult<ProductListItemDto>> {
    return this.productsService.findAll(query);
  }

  // GET /products/trending
  @Get('trending')
  @ApiOperation({ summary: 'Top 12 trending products by sold count' })
  @ApiResponse({ status: 200, type: [ProductListItemDto] })
  findTrending(): Promise<ProductListItemDto[]> {
    return this.productsService.findTrending();
  }

  // GET /products/:slug
  @Get(':slug')
  @ApiOperation({ summary: 'Get product detail by slug' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<ProductResponseDto> {
    // Use IP+UA hash as debounce key for view count
    const lockId = this.buildViewLockId(req);
    return this.productsService.findBySlug(slug, lockId);
  }

  // GET /products/:slug/related
  @Get(':id/related')
  @ApiOperation({ summary: 'Get 8 related products (same category + tags)' })
  @ApiResponse({ status: 200, type: [ProductListItemDto] })
  findRelated(@Param('id', ParseCuidPipe) id: string): Promise<ProductListItemDto[]> {
    return this.productsService.findRelated(id);
  }

  private buildViewLockId(req: Request): string {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? 'unknown';
    const ua = req.headers['user-agent'] ?? '';
    // Simple non-cryptographic fingerprint — not security-sensitive
    return Buffer.from(`${ip}:${ua}`).toString('base64').substring(0, 32);
  }
}
