import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import {
  ProductDetail,
  ProductDetailSchema,
} from '../catalog/schemas/product-detail.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductDetail.name, schema: ProductDetailSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
