import { PrismaClient } from '@prisma/client';

// ── Wishlists ──────────────────────────────────────────────────────────────────

const WISHLIST_DEFS: Array<{ email: string; productSlugs: string[] }> = [
  {
    email: 'alice@test.com',
    productSlugs: ['anniversary-map-print', 'couples-mug-set', 'personalized-canvas-print', 'family-name-sign'],
  },
  {
    email: 'bob@test.com',
    productSlugs: ['custom-name-hoodie', 'monogram-tumbler', 'personalized-cutting-board'],
  },
  {
    email: 'carol@test.com',
    productSlugs: ['custom-photo-ornament', 'custom-photo-pillow', 'personalized-graduation-frame', 'custom-birth-stats-print'],
  },
  {
    email: 'dave@test.com',
    productSlugs: ['family-name-sign', 'personalized-wine-glass', 'anniversary-map-print'],
  },
  {
    email: 'emma@test.com',
    productSlugs: ['pet-portrait-canvas', 'custom-pet-portrait-pillow', 'custom-photo-phone-case'],
  },
  {
    email: 'grace@test.com',
    productSlugs: ['personalized-tote-bag', 'custom-name-keychain', 'custom-baby-onesie'],
  },
  {
    email: 'hannah@test.com',
    productSlugs: ['custom-name-photo-mug', 'custom-family-reunion-tshirt', 'custom-name-keychain'],
  },
];

// ── Product Q&A ────────────────────────────────────────────────────────────────

const QA_DEFS: Array<{
  productSlug:   string;
  question:      string;
  askedByName:   string;
  askedByEmail?: string;
  answer:        string;
}> = [
  {
    productSlug:  'custom-name-photo-mug',
    question:     'Is the photo dishwasher safe?',
    askedByName:  'Jennifer K.',
    answer:       'Yes! Our sublimation printing is dishwasher safe. We recommend the top rack for best longevity, but the design won\'t fade or scratch with normal use.',
  },
  {
    productSlug:  'custom-name-photo-mug',
    question:     'How long does production take?',
    askedByName:  'Marcus T.',
    answer:       'Standard production is 3–5 business days. We offer rush processing for an additional fee. Shipping adds 3–7 days domestically.',
  },
  {
    productSlug:  'personalized-canvas-print',
    question:     'What resolution does my photo need to be?',
    askedByName:  'Sarah M.',
    answer:       'For best results, your photo should be at least 1200×1600px for a 12×16" canvas. We\'ll notify you if your uploaded image may appear pixelated.',
  },
  {
    productSlug:  'personalized-canvas-print',
    question:     'Is the canvas ready to hang?',
    askedByName:  'Tyler B.',
    answer:       'Yes! Every canvas comes gallery-wrapped with a hanging kit included. Just choose your spot and hang it straight away.',
  },
  {
    productSlug:  'monogram-tumbler',
    question:     'Can I put two initials instead of three?',
    askedByName:  'Rachel L.',
    answer:       'Absolutely! When personalizing, simply enter 1, 2, or 3 initials. Our designers will center them beautifully for any combination.',
  },
  {
    productSlug:  'personalized-cutting-board',
    question:     'Is the bamboo food safe?',
    askedByName:  'Oliver W.',
    answer:       'Yes, all our bamboo boards are finished with a food-grade mineral oil sealant. The engraving is purely surface-level and won\'t affect food safety.',
  },
  {
    productSlug:  'personalized-cutting-board',
    question:     'Can I add a second line of text?',
    askedByName:  'Priya S.',
    answer:       'Yes! Use the customization fields to add a subtitle — for example "Est. 2019" or a family motto. We support up to 2 lines of personalized text.',
  },
  {
    productSlug:  'custom-name-hoodie',
    question:     'Does the print crack after washing?',
    askedByName:  'Kevin D.',
    answer:       'Our DTG (Direct-to-Garment) prints are highly durable. Wash inside out on cold, tumble dry low, and the design will last as long as the garment.',
  },
  {
    productSlug:  'pet-portrait-canvas',
    question:     'How many pets can I include in one portrait?',
    askedByName:  'Lily C.',
    answer:       'You can include up to 3 pets in a single portrait at the standard price. For 4 or more, contact us for a custom quote — we love group pet portraits!',
  },
  {
    productSlug:  'custom-photo-ornament',
    question:     'Can I order a custom shape not shown?',
    askedByName:  'Denise F.',
    answer:       'Currently we offer Round, Heart, and Star shapes. We\'re always expanding our range — follow us on social media to be notified when new shapes launch!',
  },
  {
    productSlug:  'anniversary-map-print',
    question:     'What date format should I use?',
    askedByName:  'Alex R.',
    answer:       'You can enter any date format you prefer — "January 14, 2018", "14.01.2018", or just the year. The star map is calculated from the exact UTC date and time you provide.',
  },
  {
    productSlug:  'family-name-sign',
    question:     'What font options are available?',
    askedByName:  'Christine P.',
    answer:       'We offer 5 font styles: Classic Serif, Modern Sans, Rustic Script, Elegant Cursive, and Bold Block. You can preview each in the customizer before ordering.',
  },
];

// ── Seed functions ─────────────────────────────────────────────────────────────

export async function seedWishlists(prisma: PrismaClient): Promise<void> {
  console.log('  ❤️  Seeding wishlists...');
  let count = 0;

  for (const def of WISHLIST_DEFS) {
    const user = await prisma.user.findUnique({ where: { email: def.email } });
    if (!user) continue;

    for (const slug of def.productSlugs) {
      const product = await prisma.product.findFirst({ where: { slug } });
      if (!product) continue;
      await prisma.wishlistItem.upsert({
        where:  { userId_productId: { userId: user.id, productId: product.id } },
        update: {},
        create: { userId: user.id, productId: product.id },
      });
      count++;
    }
  }
  console.log(`    ✓ ${count} wishlist items seeded`);
}

export async function seedProductQandA(prisma: PrismaClient): Promise<void> {
  console.log('  ❓ Seeding product Q&A...');
  let count = 0;

  for (const def of QA_DEFS) {
    const product = await prisma.product.findFirst({ where: { slug: def.productSlug } });
    if (!product) { console.warn(`    ⚠  Product not found: ${def.productSlug}`); continue; }

    await prisma.productQuestion.create({
      data: {
        productId:    product.id,
        question:     def.question,
        askedByName:  def.askedByName,
        askedByEmail: def.askedByEmail ?? null,
        isGuest:      true,
        answer:       def.answer,
        answeredAt:   new Date(),
        isPublished:  true,
        upvotes:      Math.floor(Math.random() * 15),
      },
    });
    count++;
  }
  console.log(`    ✓ ${count} Q&A entries seeded`);
}
