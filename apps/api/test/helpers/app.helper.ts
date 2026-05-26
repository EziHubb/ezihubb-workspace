import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app/app.module';

let app: INestApplication;
let moduleRef: TestingModule;

export async function createTestApp(): Promise<INestApplication> {
  moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist:              true,
      forbidNonWhitelisted:   true,
      transform:              true,
      transformOptions:       { enableImplicitConversion: true },
    }),
  );

  await app.init();
  return app;
}

export async function closeTestApp(): Promise<void> {
  await app?.close();
}
