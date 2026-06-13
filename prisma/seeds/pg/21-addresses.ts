import { PrismaClient } from '@prisma/client';

export async function seedAddresses(prisma: PrismaClient): Promise<void> {
  console.log('  📍 Seeding user addresses...');

  const addressDefs = [
    {
      email:    'alice@test.com',
      fullName: 'Alice Johnson',
      phone:    '+1 512-555-0101',
      addressLine1: '456 Daisy Blvd',
      city:     'Austin', state: 'TX', postalCode: '78702', country: 'US', isDefault: true,
    },
    {
      email:    'bob@test.com',
      fullName: 'Bob Smith',
      phone:    '+1 415-555-0202',
      addressLine1: '789 Sunflower St',
      city:     'San Francisco', state: 'CA', postalCode: '94105', country: 'US', isDefault: true,
    },
    {
      email:    'carol@test.com',
      fullName: 'Carol Williams',
      phone:    '+1 212-555-0303',
      addressLine1: '321 Rose Ave',
      addressLine2: 'Apt 4B',
      city:     'New York', state: 'NY', postalCode: '10001', country: 'US', isDefault: true,
    },
    {
      email:    'carol@test.com',
      fullName: 'Carol Williams',
      phone:    '+1 212-555-0303',
      addressLine1: '100 Work Plaza',
      city:     'New York', state: 'NY', postalCode: '10002', country: 'US', isDefault: false,
    },
    {
      email:    'dave@test.com',
      fullName: 'Dave Brown',
      phone:    '+1 773-555-0404',
      addressLine1: '55 Lily Lane',
      city:     'Chicago', state: 'IL', postalCode: '60601', country: 'US', isDefault: true,
    },
    {
      email:    'emma@test.com',
      fullName: 'Emma Davis',
      phone:    '+1 305-555-0505',
      addressLine1: '88 Orchid Dr',
      city:     'Miami', state: 'FL', postalCode: '33101', country: 'US', isDefault: true,
    },
    {
      email:    'frank@test.com',
      fullName: 'Frank Miller',
      phone:    '+1 206-555-0606',
      addressLine1: '12 Violet Way',
      city:     'Seattle', state: 'WA', postalCode: '98101', country: 'US', isDefault: true,
    },
    {
      email:    'grace@test.com',
      fullName: 'Grace Wilson',
      phone:    '+1 617-555-0707',
      addressLine1: '7 Tulip St',
      city:     'Boston', state: 'MA', postalCode: '02101', country: 'US', isDefault: true,
    },
    {
      email:    'hannah@test.com',
      fullName: 'Hannah Taylor',
      phone:    '+1 303-555-0808',
      addressLine1: '24 Peony Ct',
      city:     'Denver', state: 'CO', postalCode: '80201', country: 'US', isDefault: true,
    },
  ];

  let count = 0;
  for (const def of addressDefs) {
    const user = await prisma.user.findUnique({ where: { email: def.email } });
    if (!user) continue;
    await prisma.address.create({
      data: {
        userId:       user.id,
        fullName:     def.fullName,
        phone:        def.phone,
        addressLine1: def.addressLine1,
        addressLine2: def.addressLine2 ?? null,
        city:         def.city,
        state:        def.state,
        postalCode:   def.postalCode,
        country:      def.country,
        isDefault:    def.isDefault,
      },
    });
    count++;
  }
  console.log(`    ✓ ${count} addresses seeded`);
}
