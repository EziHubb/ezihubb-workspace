import { PrismaClient } from '@prisma/client';

export async function seedShippingProfiles(prisma: PrismaClient) {
  console.log('  📦 Seeding shipping profiles...');

  let standard = await prisma.shippingProfile.findFirst({ where: { name: 'Standard Shipping' } });
  if (!standard) {
    standard = await prisma.shippingProfile.create({
      data: { name: 'Standard Shipping', type: 'fixed', isDefault: true },
    });
  }

  let express = await prisma.shippingProfile.findFirst({ where: { name: 'Express Shipping' } });
  if (!express) {
    express = await prisma.shippingProfile.create({
      data: { name: 'Express Shipping', type: 'fixed', isDefault: false },
    });
  }

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
