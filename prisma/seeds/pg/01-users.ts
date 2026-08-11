import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/** Real admin account only — safe to run against production. */
export async function seedAdminUser(prisma: PrismaClient) {
  console.log('  👤 Seeding admin user...');

  const adminHash = await bcrypt.hash(process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin@123456', 12);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@ezihubb.com' },
    update: {},
    create: {
      email:           'admin@ezihubb.com',
      passwordHash:    adminHash,
      firstName:       'Super',
      lastName:        'Admin',
      role:            'SUPER_ADMIN',
      isEmailVerified: true,
      isActive:        true,
    },
  });
  console.log(`    ✓ Admin: ${admin.email}`);

  return { admin };
}

/** Demo data (fake customers/seller with known passwords) — dev/staging only, never production. */
export async function seedUsers(prisma: PrismaClient) {
  const { admin } = await seedAdminUser(prisma);
  const customerHash = await bcrypt.hash('Customer@123456', 12);

  // ── Test customers ────────────────────────────────────────────────────────
  const customerDefs = [
    { email: 'alice@test.com',   firstName: 'Alice',   lastName: 'Johnson'  },
    { email: 'bob@test.com',     firstName: 'Bob',     lastName: 'Smith'    },
    { email: 'carol@test.com',   firstName: 'Carol',   lastName: 'Williams' },
    { email: 'dave@test.com',    firstName: 'Dave',    lastName: 'Brown'    },
    { email: 'emma@test.com',    firstName: 'Emma',    lastName: 'Davis'    },
    { email: 'frank@test.com',   firstName: 'Frank',   lastName: 'Miller'   },
    { email: 'grace@test.com',   firstName: 'Grace',   lastName: 'Wilson'   },
    { email: 'hannah@test.com',  firstName: 'Hannah',  lastName: 'Taylor'   },
  ];

  const customers = await Promise.all(
    customerDefs.map(def =>
      prisma.user.upsert({
        where:  { email: def.email },
        update: {},
        create: {
          email:           def.email,
          passwordHash:    customerHash,
          firstName:       def.firstName,
          lastName:        def.lastName,
          role:            'CUSTOMER',
          isEmailVerified: true,
          isActive:        true,
        },
      })
    )
  );
  console.log(`    ✓ ${customers.length} test customers`);

  // ── Test seller (in addition to admin) ────────────────────────────────────
  const sellerHash = await bcrypt.hash('Seller@123456', 12);
  const seller = await prisma.user.upsert({
    where:  { email: 'seller@test.com' },
    update: {},
    create: {
      email:           'seller@test.com',
      passwordHash:    sellerHash,
      firstName:       'Sophie',
      lastName:        'Creator',
      role:            'CUSTOMER',
      isEmailVerified: true,
      isSeller:        false,
      isActive:        true,
    },
  });
  console.log(`    ✓ Test seller: ${seller.email}`);

  return { admin, customers, seller };
}
