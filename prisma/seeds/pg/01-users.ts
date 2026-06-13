import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
  console.log('  👤 Seeding users...');

  const adminHash    = await bcrypt.hash(process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin@123456', 12);
  const customerHash = await bcrypt.hash('Customer@123456', 12);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@dailydaisy.com' },
    update: {},
    create: {
      email:           'admin@dailydaisy.com',
      passwordHash:    adminHash,
      firstName:       'Super',
      lastName:        'Admin',
      role:            'SUPER_ADMIN',
      isEmailVerified: true,
      isActive:        true,
      referralCode:    'ADMIN2024',
    },
  });
  console.log(`    ✓ Admin: ${admin.email}`);

  // ── Test customers ────────────────────────────────────────────────────────
  const customerDefs = [
    { email: 'alice@test.com',   firstName: 'Alice',   lastName: 'Johnson',  referralCode: 'ALICE10' },
    { email: 'bob@test.com',     firstName: 'Bob',     lastName: 'Smith',    referralCode: 'BOB20'   },
    { email: 'carol@test.com',   firstName: 'Carol',   lastName: 'Williams', referralCode: 'CAROL30' },
    { email: 'dave@test.com',    firstName: 'Dave',    lastName: 'Brown',    referralCode: 'DAVE40'  },
    { email: 'emma@test.com',    firstName: 'Emma',    lastName: 'Davis',    referralCode: 'EMMA50'  },
    { email: 'frank@test.com',   firstName: 'Frank',   lastName: 'Miller',   referralCode: 'FRANK60' },
    { email: 'grace@test.com',   firstName: 'Grace',   lastName: 'Wilson',   referralCode: 'GRACE70' },
    { email: 'hannah@test.com',  firstName: 'Hannah',  lastName: 'Taylor',   referralCode: 'HANNAH80'},
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
          referralCode:    def.referralCode,
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
      referralCode:    'SOPHIE99',
    },
  });
  console.log(`    ✓ Test seller: ${seller.email}`);

  return { admin, customers, seller };
}
