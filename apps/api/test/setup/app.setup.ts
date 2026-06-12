import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as request from 'supertest';

export interface TestApp {
  app: INestApplication;
  prisma: PrismaService;
  request: ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');
  await app.init();

  const prisma = app.get(PrismaService);

  return { app, prisma, request: request(app.getHttpServer()) };
}

export async function closeTestApp(testApp: TestApp): Promise<void> {
  await testApp.prisma.$disconnect();
  await testApp.app.close();
}
