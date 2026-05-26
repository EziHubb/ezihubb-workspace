import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsController } from './products.controller';
import { AdminProductsController } from './admin-products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [MulterModule.register({ storage: memoryStorage() })],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
