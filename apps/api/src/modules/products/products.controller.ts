import { BadRequestException, Controller, Get, HttpCode, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductListItemDto } from './dto/product-list-item.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { PaginatedResult } from '../../common/dto/paginated-response.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { TranslatableResponse } from '../../common/interceptors/i18n.interceptor';

@ApiTags('Products')
// Class-level guard: recently-viewed and :id/viewed read @CurrentUser() and
// had no guard, so an unauthenticated caller got a 200 and shared one Redis
// key (user:undefined:viewed) with every other anonymous visitor. The four
// browse routes carry @Public(), which JwtAuthGuard honours.
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // GET /products
  @Public()
  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @TranslatableResponse('Product')
  @ApiOperation({ summary: 'List products with filters, sorting, and pagination' })
  @ApiResponse({ status: 200, type: [ProductListItemDto] })
  findAll(@Query() query: ProductQueryDto): Promise<PaginatedResult<ProductListItemDto>> {
    return this.productsService.findAll(query);
  }

  // GET /products/trending
  @Public()
  @Get('trending')
  @TranslatableResponse('Product')
  @ApiOperation({ summary: 'Top 12 trending products by sold count' })
  @ApiResponse({ status: 200, type: [ProductListItemDto] })
  findTrending(): Promise<ProductListItemDto[]> {
    return this.productsService.findTrending();
  }

  // GET /products/recently-viewed  (must be before /:slug to avoid route conflict)
  @Get('recently-viewed')
  @TranslatableResponse('Product')
  @ApiOperation({ summary: 'Last 8 products viewed by the authenticated user' })
  @ApiResponse({ status: 200, type: [ProductListItemDto] })
  getRecentlyViewed(
    @CurrentUser('sub') userId: string,
  ): Promise<ProductListItemDto[]> {
    return this.productsService.getRecentlyViewed(userId);
  }

  // GET /products/:slug
  @Public()
  @Get(':slug')
  @TranslatableResponse('Product')
  @ApiOperation({ summary: 'Get product detail by slug' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  findBySlug(
    @Param('slug') slug: string,
    @Req() req: Request,
  ): Promise<ProductResponseDto> {
    const lockId = this.buildViewLockId(req);
    return this.productsService.findBySlug(slug, lockId);
  }

  // GET /products/:slug/related
  @Public()
  @Get(':slug/related')
  @TranslatableResponse('Product')
  @ApiOperation({ summary: 'Get 8 related products (same category + tags)' })
  @ApiResponse({ status: 200, type: [ProductListItemDto] })
  findRelated(@Param('slug') slug: string): Promise<ProductListItemDto[]> {
    return this.productsService.findRelated(slug);
  }

  // Guest carts can contain personalization, so this upload is public. The
  // service validates the file against the exact option configured on the
  // product before storing it.
  @Public()
  @Post(':id/custom-options/:optionId/upload')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  @ApiOperation({ summary: 'Upload a buyer file for a product custom option' })
  uploadCustomOptionFile(
    @Param('id', ParseCuidPipe) productId: string,
    @Param('optionId') optionId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({ code: 'ERR_VALIDATION', message: 'No file provided' });
    }
    return this.productsService.uploadCustomOptionFile(productId, optionId, file);
  }

  // POST /products/:id/viewed
  @Post(':id/viewed')
  @HttpCode(204)
  @ApiOperation({ summary: 'Record a product view for the authenticated user' })
  @ApiResponse({ status: 204 })
  trackViewed(
    @Param('id', ParseCuidPipe) productId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<void> {
    return this.productsService.trackViewed(productId, userId);
  }

  private buildViewLockId(req: Request): string {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? 'unknown';
    const ua = req.headers['user-agent'] ?? '';
    return Buffer.from(`${ip}:${ua}`).toString('base64').substring(0, 32);
  }
}
