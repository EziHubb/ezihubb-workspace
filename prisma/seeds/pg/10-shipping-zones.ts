import { PrismaClient } from '@prisma/client';

export async function seedShippingZones(prisma: PrismaClient) {
  console.log('  🚚 Seeding shipping zones...');

  const usZone = await prisma.shippingZone.findFirst({ where: { name: 'United States' } });
  if (!usZone) {
    await prisma.shippingZone.create({
      data: {
        name:      'United States',
        countries: ['US'],
        methods: {
          create: [
            { name: 'Standard (5-10 days)', carrier: 'USPS',  price: 4.99,  freeShippingOver: 50, minDays: 5,  maxDays: 10 },
            { name: 'Express (2-3 days)',   carrier: 'FedEx', price: 14.99, minDays: 2, maxDays: 3  },
            { name: 'Overnight',            carrier: 'UPS',   price: 29.99, minDays: 1, maxDays: 1  },
          ],
        },
      },
    });
    console.log('    ✓ Shipping zone: United States');
  } else {
    console.log('    ⏭  Shipping zone: United States (exists)');
  }

  const intlZone = await prisma.shippingZone.findFirst({ where: { name: 'International' } });
  if (!intlZone) {
    await prisma.shippingZone.create({
      data: {
        name:      'International',
        countries: ['CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'SG', 'NZ'],
        methods: {
          create: [
            { name: 'Standard International (14-21 days)', carrier: 'USPS',  price: 19.99, minDays: 14, maxDays: 21 },
            { name: 'Express International (7-10 days)',   carrier: 'FedEx', price: 39.99, minDays: 7,  maxDays: 10 },
          ],
        },
      },
    });
    console.log('    ✓ Shipping zone: International');
  } else {
    console.log('    ⏭  Shipping zone: International (exists)');
  }
}
