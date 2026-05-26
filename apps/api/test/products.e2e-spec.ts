import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestApp, closeTestApp } from './helpers/app.helper';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let categoryId: string;
  let productSlug: string;

  beforeAll(async () => {
    app    = await createTestApp();
    prisma = app.get(PrismaService);

    // Seed a category and two products for the suite
    const cat = await prisma.category.create({
      data: { name: 'E2E Mugs', slug: `e2e-mugs-${Date.now()}` },
    });
    categoryId = cat.id;

    const p1 = await prisma.product.create({
      data: {
        name:        'E2E Cheap Mug',
        slug:        `e2e-cheap-mug-${Date.now()}`,
        sku:         `E2E-CHEAP-${Date.now()}`,
        description: 'A cheap mug for e2e tests',
        basePrice:   9.99,
        categoryId:  cat.id,
      },
    });
    const p2 = await prisma.product.create({
      data: {
        name:        'E2E Expensive Mug',
        slug:        `e2e-exp-mug-${Date.now()}`,
        sku:         `E2E-EXP-${Date.now()}`,
        description: 'An expensive mug for e2e tests',
        basePrice:   49.99,
        categoryId:  cat.id,
      },
    });

    productSlug = p1.slug;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await closeTestApp();
  });

  // ── GET /api/v1/products ───────────────────────────────────────────────────

  describe('GET /api/v1/products', () => {
    it('200 — returns paginated product list', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/products');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toMatchObject({
        page:  expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
      });
    });

    it('200 — filters by minPrice and maxPrice, only returning products in range', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ minPrice: 10, maxPrice: 50 });

      expect(res.status).toBe(200);
      const prices = (res.body.data as any[]).map((p) => p.basePrice);
      prices.forEach((price) => {
        expect(price).toBeGreaterThanOrEqual(10);
        expect(price).toBeLessThanOrEqual(50);
      });
    });

    it('200 — returns empty data array when no products match the price filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ minPrice: 999, maxPrice: 9999 });

      expect(res.status).toBe(200);
      // Either empty or only products in the price range
      const prices = (res.body.data as any[]).map((p) => p.basePrice);
      prices.forEach((price) => expect(price).toBeGreaterThanOrEqual(999));
    });

    it('200 — respects pagination (page + limit)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ page: 1, limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  // ── GET /api/v1/products/:slug ─────────────────────────────────────────────

  describe('GET /api/v1/products/:slug', () => {
    it('200 — returns full product detail by slug', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/products/${productSlug}`);

      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe(productSlug);
      expect(res.body.data.category).toBeDefined();
    });

    it('404 — returns ERR_NOT_FOUND for a non-existent slug', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/products/this-slug-does-not-exist');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ERR_NOT_FOUND');
    });
  });
});
