import { PrismaClient } from '@prisma/client';

export async function seedGiftCards(prisma: PrismaClient): Promise<void> {
  console.log('  🎁 Seeding gift cards...');

  const giftCards = [
    {
      code:           'DAISY-GC-0025',
      initialValue:   25.00,
      balance:        25.00,
      isActive:       true,
      recipientEmail: 'alice@test.com',
      recipientName:  'Alice Johnson',
      personalMessage: 'Happy Birthday, Alice! Treat yourself to something special 🌼',
    },
    {
      code:           'DAISY-GC-0050',
      initialValue:   50.00,
      balance:        50.00,
      isActive:       true,
      recipientEmail: 'bob@test.com',
      recipientName:  'Bob Smith',
      personalMessage: 'Thanks for being an amazing friend! Enjoy shopping at EziHubb 🛍️',
    },
    {
      code:           'DAISY-GC-0100',
      initialValue:   100.00,
      balance:        100.00,
      isActive:       true,
      recipientEmail: 'carol@test.com',
      recipientName:  'Carol Williams',
      personalMessage: 'Congratulations on your promotion! You deserve something wonderful.',
    },
    {
      code:           'DAISY-GC-0075',
      initialValue:   75.00,
      balance:        42.50,
      isActive:       true,
      recipientEmail: 'emma@test.com',
      recipientName:  'Emma Davis',
      personalMessage: 'Happy Holidays from the whole team! ❄️',
    },
    {
      code:           'DAISY-GC-0200',
      initialValue:   200.00,
      balance:        200.00,
      isActive:       true,
      recipientEmail: 'dave@test.com',
      recipientName:  'Dave Brown',
      personalMessage: 'Wedding gift — congratulations! May your home be filled with beautiful things.',
    },
    {
      code:           'DAISY-GC-0010',
      initialValue:   10.00,
      balance:        0.00,
      isActive:       false,
      recipientEmail: 'frank@test.com',
      recipientName:  'Frank Miller',
      personalMessage: 'Small token of appreciation!',
    },
    {
      code:           'DAISY-GC-TEST',
      initialValue:   500.00,
      balance:        500.00,
      isActive:       true,
      recipientEmail: null,
      recipientName:  null,
      personalMessage: null,
    },
  ];

  for (const gc of giftCards) {
    await prisma.giftCard.upsert({
      where:  { code: gc.code },
      update: {},
      create: gc,
    });
    console.log(`    ✓ Gift card ${gc.code} — $${gc.initialValue}`);
  }
}
