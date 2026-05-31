import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

/**
 * MongoDBModule — global Mongoose connection.
 *
 * Consumed by modules that register their own schemas via:
 *   MongooseModule.forFeature([{ name: ProductDetail.name, schema: ProductDetailSchema }])
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri:    config.get<string>('MONGODB_URI') ?? 'mongodb://localhost:27017',
        dbName: 'mapleloomhandmade',
        // Connection pool tuning
        maxPoolSize:    10,
        connectTimeoutMS: 10_000,
        serverSelectionTimeoutMS: 10_000,
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class MongoDBModule {}
