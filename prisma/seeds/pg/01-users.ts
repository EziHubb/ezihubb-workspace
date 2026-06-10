import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
  console.log('  👤 Seeding users...');

  const adminHash    = await bcrypt.hash(process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin@123456', 12);
  const customerHash = await bcrypt.hash('Customer@123456', 12);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@mapleloomhandmade.com' },
    update: {},
    create: {
      email:           'admin@mapleloomhandmade.com',
      passwordHash:    adminHash,
      firstName:       'Super',
      lastName:        'Admin',
      role:            'SUPER_ADMIN',
      isEmailVerified: true,
    },
  });
  console.log(`    ✓ Admin: ${admin.email}`);

  const customers = await Promise.all([
    prisma.user.upsert({
      where:  { email: 'alice@test.com' },
      update: {},
      create: {
        email:           'alice@test.com',
        passwordHash:    customerHash,
        firstName:       'Alice',
        lastName:        'Johnson',
        role:            'CUSTOMER',
        isEmailVerified: true,
      },
    }),
    prisma.user.upsert({
      where:  { email: 'bob@test.com' },
      update: {},
      create: {
        email:           'bob@test.com',
        passwordHash:    customerHash,
        firstName:       'Bob',
        lastName:        'Smith',
        role:            'CUSTOMER',
        isEmailVerified: true,
      },
    }),
  ]);
  console.log(`    ✓ ${customers.length} test customers`);

  return { admin, customers };
}
