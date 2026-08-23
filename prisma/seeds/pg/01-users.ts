import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * The platform's SUPER_ADMIN account — the only user any seed creates.
 *
 * This file used to carry a second export, `seedUsers`, which added eight
 * `@test.com` customers and a test seller whose passwords were written into
 * the source. That is fine in a private repo and a disaster in a public one:
 * the credentials shipped with the code, so anyone reading it held working
 * logins for whatever database the seed had last been pointed at. It went
 * with the rest of the demo dataset.
 *
 * Set SEED_ADMIN_PASSWORD before running this anywhere that matters. The
 * fallback below exists so a local `db:fresh` does not need setup, and it is
 * published in this file — an account still carrying it is unprotected.
 */
export async function seedAdminUser(prisma: PrismaClient) {
  console.log('  👤 Seeding admin user...');

  const adminHash = await bcrypt.hash(process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin@123456', 12);

  const admin = await prisma.user.upsert({
    where:  { email: 'admin@ezihubb.com' },
    // Empty on purpose: re-running the seed must never reset the password of
    // a live admin account back to the published default.
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
