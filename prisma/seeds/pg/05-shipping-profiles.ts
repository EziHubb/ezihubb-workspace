import { PrismaClient } from '@prisma/client';

export async function seedShippingProfiles(prisma: PrismaClient) {
  console.log('  📦 Seeding shipping profiles...');

  const [standard, express] = await Promise.all([
    prisma.shippingProfile.upsert({
      where:  { name: 'Standard Shipping' },
      update: {},
      create: { name: 'Standard Shipping', type: 'fixed', isDefault: true  },
    }),
    prisma.shippingProfile.upsert({
      where:  { name: 'Express Shipping' },
      update: {},
      create: { name: 'Express Shipping',  type: 'fixed', isDefault: false },
    }),
  ]);

  const existing = await prisma.shippingProfileMethod.count({ where: { profileId: standard.id } });
  if (!existing) {
    await prisma.shippingProfileMethod.createMany({
      data: [
        { profileId: standard.id, destinationType: 'domestic',        carrier: 'USPS',  minDays: 5,  maxDays: 10, price: 4.99,  extraItemPrice: 0.50 },
        { profileId: standard.id, destinationType: 'everywhere_else', carrier: 'USPS',  minDays: 10, maxDays: 21, price: 12.99, extraItemPrice: 1.50 },
        { profileId: express.id,  destinationType: 'domestic',        carrier: 'FedEx', minDays: 2,  maxDays: 3,  price: 14.99, extraItemPrice: 2.00 },
      ],
    });
  }

  console.log('    ✓ 2 shipping profiles (Standard, Express)');
}
