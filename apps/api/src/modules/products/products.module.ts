import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { memoryStorage } from 'multer';
import { ProductsController } from './products.controller';
import { AdminProductsController } from './admin-products.controller';
import { CsvImportController } from './csv-import.controller';
import { QaController } from './qa.controller';
import { AdminQaController } from './admin-qa.controller';
import { ProductsService } from './products.service';
import { CsvImportService } from './csv-import.service';
import { QaService } from './qa.service';
import { LowStockService } from './low-stock.service';
import { LowStockProcessor } from '../../queue/low-stock.processor';
import {
  ProductDetail,
  ProductDetailSchema,
} from '../catalog/schemas/product-detail.schema';
import { AnalyticsModule } from '../analytics/analytics.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DevBullModule } from '../../queue/dev-bull.module';
import { QUEUES } from '../../queue/queue.constants';

const disableQueue = process.env['DISABLE_QUEUE'] === 'true';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    MongooseModule.forFeature([
      { name: ProductDetail.name, schema: ProductDetailSchema },
    ]),
    AnalyticsModule,
    NotificationsModule,
    ...(disableQueue
      ? [DevBullModule.forQueues([QUEUES.LOW_STOCK])]
      : [BullModule.registerQueue({ name: QUEUES.LOW_STOCK })]),
  ],
  controllers: [
    ProductsController,
    AdminProductsController,
    CsvImportController,
    QaController,
    AdminQaController,
  ],
  providers: [
    ProductsService,
    CsvImportService,
    QaService,
    LowStockService,
    ...(disableQueue ? [] : [LowStockProcessor]),
  ],
  exports: [ProductsService, LowStockService],
})
export class ProductsModule {}
