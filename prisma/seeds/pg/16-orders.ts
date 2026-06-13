import { PrismaClient, OrderStatus } from '@prisma/client';

type OrderDef = {
  email: string;
  status: OrderStatus;
  productSlugs: string[];
  couponCode?: string;
  isGift?: boolean;
  giftMessage?: string;
  daysAgo: number;
  trackingNumber?: string;
  carrier?: string;
};

const ORDER_DEFS: OrderDef[] = [
  {
    email: 'alice@test.com', status: 'DELIVERED', daysAgo: 30,
    productSlugs: ['custom-name-photo-mug', 'personalized-tote-bag'],
    trackingNumber: 'USPS1234567890', carrier: 'USPS',
  },
  {
    email: 'alice@test.com', status: 'COMPLETED', daysAgo: 60,
    productSlugs: ['personalized-canvas-print'],
    couponCode: 'WELCOME10',
  },
  {
    email: 'bob@test.com', status: 'SHIPPED', daysAgo: 7,
    productSlugs: ['monogram-tumbler', 'custom-name-hoodie'],
    trackingNumber: 'FEDEX9876543210', carrier: 'FedEx',
  },
  {
    email: 'bob@test.com', status: 'IN_PRODUCTION', daysAgo: 2,
    productSlugs: ['personalized-cutting-board'],
    isGift: true, giftMessage: 'Happy anniversary! Love you so much 💕',
  },
  {
    email: 'carol@test.com', status: 'CONFIRMED', daysAgo: 1,
    productSlugs: ['custom-photo-ornament', 'custom-photo-phone-case', 'custom-name-keychain'],
  },
  {
    email: 'carol@test.com', status: 'DELIVERED', daysAgo: 45,
    productSlugs: ['couples-mug-set'],
    couponCode: 'FREESHIP50',
  },
  {
    email: 'dave@test.com', status: 'PENDING_PAYMENT', daysAgo: 0,
    productSlugs: ['anniversary-map-print'],
  },
  {
    email: 'dave@test.com', status: 'COMPLETED', daysAgo: 90,
    productSlugs: ['family-name-sign', 'personalized-graduation-frame'],
  },
  {
    email: 'emma@test.com', status: 'DELIVERED', daysAgo: 14,
    productSlugs: ['pet-portrait-canvas', 'custom-pet-portrait-pillow'],
    isGift: true, giftMessage: 'For my best fur baby!',
  },
  {
    email: 'emma@test.com', status: 'REFUNDED', daysAgo: 50,
    productSlugs: ['custom-family-reunion-tshirt'],
  },
  {
    email: 'frank@test.com', status: 'SHIPPED', daysAgo: 4,
    productSlugs: ['personalized-wine-glass', 'custom-birth-stats-print'],
    trackingNumber: 'USPS5432167890', carrier: 'USPS',
  },
  {
    email: 'grace@test.com', status: 'IN_PRODUCTION', daysAgo: 3,
    productSlugs: ['custom-baby-onesie'],
    isGift: true, giftMessage: 'Welcome to the world, little one! 🌸',
  },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

let orderSeq = 1000;
function nextOrderNumber() { return `DD-${String(++orderSeq).padStart(6, '0')}`; }

export async function seedOrders(
  prisma: PrismaClient,
  storeId: string,
): Promise<string[]> {
  console.log('  🛍️  Seeding orders...');

  const orderIds: string[] = [];

  for (const def of ORDER_DEFS) {
    const user = await prisma.user.findUnique({ where: { email: def.email } });
    if (!user) { console.warn(`    ⚠  Skipping order — user ${def.email} not found`); continue; }

    // Resolve products + default variants
    const items: Array<{ product: any; variant: any }> = [];
    for (const slug of def.productSlugs) {
      const product = await prisma.product.findFirst({ where: { slug }, include: { variants: true } });
      if (!product) { console.warn(`    ⚠  Product not found: ${slug}`); continue; }
      const variant = product.variants.find(v => v.isDefault) ?? product.variants[0] ?? null;
      items.push({ product, variant });
    }
    if (!items.length) continue;

    const subtotal   = items.reduce((s, i) => s + Number(i.variant?.price ?? i.product.basePrice), 0);
    const shipping   = 4.99;
    const discount   = def.couponCode === 'WELCOME10' ? subtotal * 0.1 : 0;
    const total      = Math.max(0, subtotal + shipping - discount);
    const orderDate  = daysAgo(def.daysAgo);

    const statusDates: Record<string, Partial<{ confirmedAt: Date; shippedAt: Date; deliveredAt: Date; cancelledAt: Date }>> = {
      CONFIRMED:     { confirmedAt: daysAgo(def.daysAgo - 1) },
      IN_PRODUCTION: { confirmedAt: daysAgo(def.daysAgo) },
      SHIPPED:       { confirmedAt: daysAgo(def.daysAgo + 1), shippedAt: daysAgo(def.daysAgo - 2) },
      DELIVERED:     { confirmedAt: daysAgo(def.daysAgo + 2), shippedAt: daysAgo(def.daysAgo + 5), deliveredAt: daysAgo(def.daysAgo - 1) },
      COMPLETED:     { confirmedAt: daysAgo(def.daysAgo + 3), shippedAt: daysAgo(def.daysAgo + 6), deliveredAt: daysAgo(def.daysAgo + 10) },
      CANCELLED:     { cancelledAt: daysAgo(def.daysAgo - 1) },
      REFUNDED:      { confirmedAt: daysAgo(def.daysAgo + 2), cancelledAt: daysAgo(def.daysAgo - 3) },
    };

    const order = await prisma.order.create({
      data: {
        orderNumber:    nextOrderNumber(),
        userId:         user.id,
        status:         def.status,
        shippingName:   `${user.firstName} ${user.lastName}`,
        shippingPhone:  '+1 555-000-0001',
        shippingAddress: '123 Daisy Lane',
        shippingCity:   'Austin',
        shippingState:  'TX',
        shippingZip:    '78701',
        shippingCountry: 'US',
        shippingMethod: 'Standard Shipping',
        shippingCost:   shipping,
        subtotal,
        discountAmount: discount,
        total,
        couponCode:     def.couponCode ?? null,
        isGift:         def.isGift ?? false,
        giftMessage:    def.giftMessage ?? null,
        trackingNumber: def.trackingNumber ?? null,
        carrier:        def.carrier ?? null,
        createdAt:      orderDate,
        ...(statusDates[def.status] ?? {}),
        items: {
          create: items.map(({ product, variant }) => ({
            productId:      product.id,
            variantId:      variant?.id ?? null,
            quantity:       1,
            unitPrice:      variant?.price ?? product.basePrice,
            productName:    product.name,
            variantName:    variant?.name ?? null,
            productSlug:    product.slug,
            productImageUrl: null,
            sku:            variant?.sku ?? product.sku,
            storeId,
          })),
        },
        storeOrders: {
          create: [{
            storeId,
            status:         def.status,
            subtotal,
            shippingCost:   shipping,
            platformFee:    subtotal * 0.15,
            sellerEarnings: subtotal * 0.85,
            trackingNumber: def.trackingNumber ?? null,
            carrier:        def.carrier ?? null,
            items: {
              connect: [],
            },
          }],
        },
        statusHistory: {
          create: [
            { status: 'PENDING_PAYMENT', createdAt: orderDate },
            ...(def.status !== 'PENDING_PAYMENT' ? [{ status: def.status, createdAt: new Date() }] : []),
          ],
        },
      },
    });

    // Payment record
    const paymentMethod = (def.status === 'PENDING_PAYMENT') ? 'STRIPE' : 'STRIPE';
    const paymentStatus = def.status === 'PENDING_PAYMENT' ? 'PENDING'
      : def.status === 'REFUNDED' ? 'REFUNDED'
      : 'PAID';

    await prisma.payment.upsert({
      where:  { orderId: order.id },
      update: {},
      create: {
        orderId:              order.id,
        method:               paymentMethod,
        status:               paymentStatus,
        amount:               total,
        currency:             'USD',
        stripePaymentIntentId: `pi_seed_${order.id}`,
        paidAt:               paymentStatus === 'PAID' ? orderDate : null,
        refundedAt:           paymentStatus === 'REFUNDED' ? daysAgo(def.daysAgo - 5) : null,
        refundedAmount:       paymentStatus === 'REFUNDED' ? total : 0,
      },
    });

    orderIds.push(order.id);
    console.log(`    ✓ Order ${order.orderNumber} — ${def.email} — ${def.status}`);
  }

  console.log(`    ✓ ${orderIds.length} orders seeded`);
  return orderIds;
}
