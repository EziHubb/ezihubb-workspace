import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app/app.module';
import { PrismaService } from '../prisma/prisma.service';

// Use no-op queues — avoids requiring Redis during tests
process.env['DISABLE_QUEUE'] = 'true';

export async function createTestApp(): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication({ rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

export function getPrisma(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

export async function cleanTestUsers(prisma: PrismaService, emails: string[]): Promise<void> {
  if (emails.length === 0) return;
  // Find user IDs first
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;

  // Delete dependents in FK-safe order
  const orderIds = (
    await prisma.order.findMany({ where: { userId: { in: ids } }, select: { id: true } })
  ).map((o) => o.id);

  if (orderIds.length > 0) {
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  }

  const cartIds = (
    await prisma.cart.findMany({ where: { userId: { in: ids } }, select: { id: true } })
  ).map((c) => c.id);
  if (cartIds.length > 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: { in: cartIds } } });
    await prisma.cart.deleteMany({ where: { id: { in: cartIds } } });
  }

  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.emailVerification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.passwordReset.deleteMany({ where: { userId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
  await prisma.wishlistItem.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

export async function createTestUser(
  prisma: PrismaService,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; email: string; passwordHash: string }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bcrypt = require('bcrypt') as typeof import('bcrypt');
  const ts = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `test-${ts}@ezihubb-test.invalid`,
      passwordHash: await bcrypt.hash('TestPass123!', 10),
      firstName: 'Test',
      lastName: 'User',
      role: 'CUSTOMER' as const,
      isEmailVerified: true,
      ...overrides,
    },
  });
  return user as unknown as { id: string; email: string; passwordHash: string };
}

export async function createTestAdmin(prisma: PrismaService) {
  const ts = Date.now();
  return createTestUser(prisma, {
    email: `admin-${ts}@ezihubb-test.invalid`,
    role: 'ADMIN',
  });
}
