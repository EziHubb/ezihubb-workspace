import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CollectionsController } from './collections.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CategoriesController, CollectionsController, AdminCatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
