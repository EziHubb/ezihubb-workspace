import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesController } from './categories.controller';
import { CollectionsController } from './collections.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductDetail, ProductDetailSchema } from './schemas/product-detail.schema';
import { CategoryMenu, CategoryMenuSchema } from './schemas/category-menu.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductDetail.name, schema: ProductDetailSchema },
      { name: CategoryMenu.name,  schema: CategoryMenuSchema  },
    ]),
  ],
  controllers: [CategoriesController, CollectionsController, AdminCatalogController],
  providers:   [CatalogService],
  exports:     [CatalogService],
})
export class CatalogModule {}
