import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { SearchModule } from '../search/search.module';
import { PartnerProductsController } from './partner-products.controller';
import { PartnerSearchController } from './partner-search.controller';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyThrottlerGuard } from '../../common/guards/api-key-throttler.guard';

/**
 * Holds only the public, API-key-authenticated controllers exposed to 3rd-party
 * tools. Kept separate from PartnerApiModule (which also owns the JWT-gated,
 * seller-facing key-management endpoints) so the public Swagger doc built with
 * `include: [PartnerCatalogModule]` in main.ts never leaks internal admin routes.
 */
@Module({
  imports: [PrismaModule, ProductsModule, SearchModule],
  controllers: [PartnerProductsController, PartnerSearchController],
  providers: [ApiKeyGuard, ApiKeyThrottlerGuard],
})
export class PartnerCatalogModule {}
