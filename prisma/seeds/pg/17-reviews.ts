import { PrismaClient } from '@prisma/client';

type ReviewDef = {
  userEmail:   string;
  productSlug: string;
  rating:      number;
  title:       string;
  body:        string;
  adminReply?: string;
};

const REVIEW_DEFS: ReviewDef[] = [
  {
    userEmail: 'alice@test.com', productSlug: 'custom-name-photo-mug', rating: 5,
    title: 'Absolutely perfect gift!',
    body: 'I ordered this for my mom\'s birthday and she cried happy tears! The photo quality is amazing, colors are vibrant and the mug is solid and heavy. Will definitely order again.',
    adminReply: 'Thank you so much, Alice! We\'re so glad your mom loved it 🌸',
  },
  {
    userEmail: 'alice@test.com', productSlug: 'personalized-canvas-print', rating: 5,
    title: 'Gallery-worthy quality',
    body: 'Ordered the 16×20" canvas of our family beach photo. Arrived perfectly packaged, ready to hang. The colors are true-to-life and the texture feels premium. Exceeded expectations!',
  },
  {
    userEmail: 'bob@test.com', productSlug: 'monogram-tumbler', rating: 4,
    title: 'Great tumbler, minor shipping delay',
    body: 'The tumbler itself is excellent — keeps my coffee hot all morning. Engraving is crisp and centered. Only reason for 4 stars is it arrived 2 days late. Would order again.',
    adminReply: 'Thanks for the honest review, Bob! We\'re sorry about the delay and glad the quality hit the mark.',
  },
  {
    userEmail: 'bob@test.com', productSlug: 'custom-name-hoodie', rating: 5,
    title: 'Super cozy and great print',
    body: 'Ordered matching hoodies for our whole family — the custom names printed perfectly. Fabric is thick and soft, true to size. Perfect for chilly evenings. Already ordered two more!',
  },
  {
    userEmail: 'carol@test.com', productSlug: 'couples-mug-set', rating: 5,
    title: 'Best anniversary gift ever',
    body: 'Gave these to my husband for our 5th anniversary. The matching mugs are adorable and the custom dates came out beautifully. Packaging was also gift-ready. 10/10 would recommend!',
    adminReply: 'Happy anniversary! So sweet to hear this made your celebration even more special 💕',
  },
  {
    userEmail: 'carol@test.com', productSlug: 'custom-photo-ornament', rating: 5,
    title: 'Precious Christmas keepsake',
    body: 'Ordered 6 of these as stocking stuffers with different family photos. Each one came out crisp and clear. The ceramic feels durable and they all arrived safely. Will order every year!',
  },
  {
    userEmail: 'dave@test.com', productSlug: 'family-name-sign', rating: 5,
    title: 'Exactly what we wanted',
    body: 'The engraving is deep and clean, the wood is smooth and solid. We hung it in our entryway and every guest comments on it. Great craftsmanship and fast shipping.',
  },
  {
    userEmail: 'dave@test.com', productSlug: 'personalized-graduation-frame', rating: 4,
    title: 'Beautiful frame, slight sizing note',
    body: 'Gorgeous acrylic frame for my daughter\'s graduation photo. The personalization looks elegant. Note: measure your photo before ordering — the 5×7 fits a standard 4×6 with a border.',
  },
  {
    userEmail: 'emma@test.com', productSlug: 'pet-portrait-canvas', rating: 5,
    title: 'Stunning portrait of my golden',
    body: 'Uploaded a photo of my dog Charlie and the watercolor style came out breathtaking. I cried when I opened it. Hung it in my living room and everyone asks about it. HIGHLY recommend!',
    adminReply: 'Charlie sounds like the most photogenic pup! 🐾 Thank you for this beautiful review.',
  },
  {
    userEmail: 'emma@test.com', productSlug: 'custom-pet-portrait-pillow', rating: 5,
    title: 'My cat is now a celebrity',
    body: 'Got a pillow with my cat Luna\'s portrait and it is PERFECT. She\'s obsessed with it too (of course). Print is vibrant and the pillow is fluffy and well-made. Great quality!',
  },
  {
    userEmail: 'frank@test.com', productSlug: 'personalized-wine-glass', rating: 5,
    title: 'Elegant and thoughtful gift',
    body: 'Gave personalized wine glasses to my sister and her husband for their wedding. They looked so classy at the reception! The etching is precise and won\'t fade. Great value.',
  },
  {
    userEmail: 'frank@test.com', productSlug: 'custom-birth-stats-print', rating: 5,
    title: 'Perfect new baby gift',
    body: 'Ordered this for our nephew\'s nursery. The soft beige color matches any décor and the birth stats are so neatly arranged. Parents were moved to tears. Will order for every new baby going forward!',
  },
  {
    userEmail: 'grace@test.com', productSlug: 'personalized-tote-bag', rating: 5,
    title: 'My everyday bag now',
    body: 'The canvas is sturdy, handles are strong, and the custom name print is bold and clear. I use this every day for groceries and it holds up perfectly. Great sustainable gift too!',
  },
  {
    userEmail: 'grace@test.com', productSlug: 'custom-photo-phone-case', rating: 4,
    title: 'Sharp print, snug fit',
    body: 'Print quality is impressive — my photo looks just as clear as on my screen. Fits my iPhone 15 perfectly and the case feels protective. Docking one star because it attracted fingerprints.',
  },
  {
    userEmail: 'hannah@test.com', productSlug: 'custom-name-keychain', rating: 5,
    title: 'Great little gift',
    body: 'Bought 8 of these as bridesmaids gifts with each name engraved. They came in a nice little gift box and the engraving is clean and deep. Everyone loved them!',
    adminReply: 'Congratulations on the upcoming wedding! 💍 So glad we could be part of your celebration.',
  },
  {
    userEmail: 'hannah@test.com', productSlug: 'custom-baby-onesie', rating: 5,
    title: 'Softest onesie ever',
    body: 'Ordered this as a baby shower gift with "Hello World" printed on it. The cotton is SO soft — perfect for a newborn. The print didn\'t fade after washing either. Will order more sizes as baby grows!',
  },
  {
    userEmail: 'alice@test.com', productSlug: 'anniversary-map-print', rating: 5,
    title: 'Our night sky, forever',
    body: 'Ordered a star map of our wedding night. The framed version looks absolutely stunning on our bedroom wall. Every detail is precise and the colors are romantic and beautiful.',
  },
  {
    userEmail: 'bob@test.com', productSlug: 'personalized-cutting-board', rating: 5,
    title: 'Housewarming hit',
    body: 'Gave this as a housewarming gift — our friends use it every day and say it\'s their favourite kitchen item. The engraving is deep and the bamboo is beautifully smooth. Solid quality.',
  },
];

export async function seedReviews(
  prisma: PrismaClient,
  storeId: string,
): Promise<void> {
  console.log('  ⭐ Seeding reviews...');

  let count = 0;
  for (const def of REVIEW_DEFS) {
    const user    = await prisma.user.findUnique({ where: { email: def.userEmail } });
    const product = await prisma.product.findFirst({ where: { slug: def.productSlug } });

    if (!user || !product) {
      console.warn(`    ⚠  Skipping review — user ${def.userEmail} or product ${def.productSlug} not found`);
      continue;
    }

    // Find a completed/delivered order for this user that contains this product
    const orderItem = await prisma.orderItem.findFirst({
      where: { productId: product.id },
      include: { order: true },
    });

    if (!orderItem) {
      // Create a synthetic order id string so the unique constraint doesn't block us
      const fakeOrderId = `seed-review-${user.id}-${product.id}`;
      // We need a real order — find any order for this user
      const anyOrder = await prisma.order.findFirst({ where: { userId: user.id } });
      if (!anyOrder) { console.warn(`    ⚠  No order found for ${def.userEmail}`); continue; }

      await prisma.review.upsert({
        where:  { userId_productId_orderId: { userId: user.id, productId: product.id, orderId: anyOrder.id } },
        update: {},
        create: {
          userId:          user.id,
          productId:       product.id,
          orderId:         anyOrder.id,
          rating:          def.rating,
          title:           def.title,
          body:            def.body,
          status:          'APPROVED',
          moderationStatus: 'APPROVED',
          adminReply:      def.adminReply ?? null,
          repliedAt:       def.adminReply ? new Date() : null,
          helpfulCount:    Math.floor(Math.random() * 20),
          storeId,
        },
      });
    } else {
      await prisma.review.upsert({
        where:  { userId_productId_orderId: { userId: user.id, productId: product.id, orderId: orderItem.orderId } },
        update: {},
        create: {
          userId:          user.id,
          productId:       product.id,
          orderId:         orderItem.orderId,
          rating:          def.rating,
          title:           def.title,
          body:            def.body,
          status:          'APPROVED',
          moderationStatus: 'APPROVED',
          adminReply:      def.adminReply ?? null,
          repliedAt:       def.adminReply ? new Date() : null,
          helpfulCount:    Math.floor(Math.random() * 20),
          storeId,
        },
      });
    }

    count++;
  }

  console.log(`    ✓ ${count} reviews seeded`);

  // Update product soldCount to reflect seeded orders
  const productsWithOrders = await prisma.orderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true },
  });
  for (const p of productsWithOrders) {
    if (p.productId) {
      await prisma.product.update({
        where: { id: p.productId },
        data:  { soldCount: p._sum.quantity ?? 0 },
      });
    }
  }
}
