import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MongooseModule } from '@nestjs/mongoose';
import { memoryStorage } from 'multer';
import { ProductsController } from './products.controller';
import { AdminProductsController } from './admin-products.controller';
import { CsvImportController } from './csv-import.controller';
import { QaController } from './qa.controller';
import { AdminQaController } from './admin-qa.controller';
import { ProductsService } from './products.service';
import { CsvImportService } from './csv-import.service';
import { QaService } from './qa.service';
import {
  ProductDetail,
  ProductDetailSchema,
} from '../catalog/schemas/product-detail.schema';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    MongooseModule.forFeature([
      { name: ProductDetail.name, schema: ProductDetailSchema },
    ]),
    AnalyticsModule,
    NotificationsModule,
  ],
  controllers: [
    ProductsController,
    AdminProductsController,
    CsvImportController,
    QaController,
    AdminQaController,
  ],
  providers: [ProductsService, CsvImportService, QaService],
  exports:   [ProductsService],
})
export class ProductsModule {}
