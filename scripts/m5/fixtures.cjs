const { createHash } = require('node:crypto');
const { assertDatabaseIdentity } = require('./guard.cjs');
const bcrypt = require('bcrypt');

const VERSION = 'm5-foundation-fixtures-v1';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const select = {
  user: { id: true, email: true, role: true, isSeller: true, storeId: true, isEmailVerified: true, passwordHash: true },
  store: { id: true, slug: true, ownerId: true, status: true, fulfillmentMode: true },
  product: { id: true, sku: true, storeId: true, basePrice: true, quantity: true, trackInventory: true, productType: true },
  order: { id: true, orderNumber: true, status: true, subtotal: true, total: true, shippingCost: true, guestEmail: true },
};
async function snapshot(db, ids) {
  return {
    users: await db.user.findMany({ where: { id: { in: ids.users } }, select: select.user, orderBy: { id: 'asc' } }),
    stores: await db.store.findMany({ where: { id: { in: ids.stores } }, select: select.store, orderBy: { id: 'asc' } }),
    products: await db.product.findMany({ where: { id: { in: ids.products } }, select: select.product, orderBy: { id: 'asc' } }),
    variants: await db.productVariant.findMany({ where: { id: { in: ids.variants } }, select: { id: true, productId: true, quantity: true, price: true }, orderBy: { id: 'asc' } }),
    settings: await db.variationSettings.findMany({ where: { productId: { in: ids.products } }, select: { productId: true, enableVariations: true, variesBy: true }, orderBy: { productId: 'asc' } }),
    orders: await db.order.findMany({ where: { id: { in: ids.orders } }, select: select.order, orderBy: { id: 'asc' } }),
    shops: await db.storeOrder.findMany({ where: { orderId: { in: ids.orders } }, select: { id: true, orderId: true, storeId: true, subtotal: true, shippingCost: true, sellerEarnings: true }, orderBy: { id: 'asc' } }),
    items: await db.orderItem.findMany({ where: { orderId: { in: ids.orders } }, select: { id: true, productId: true, storeId: true, storeOrderId: true, quantity: true, unitPrice: true }, orderBy: { id: 'asc' } }),
    affiliates: await db.affiliateAccount.findMany({ where: { id: { in: ids.affiliates } }, select: { id: true, userId: true, status: true, balance: true }, orderBy: { id: 'asc' } }),
  };
}
async function verifyFixtureReceipt(db, receipt) {
  if (receipt.version !== VERSION || digest(await snapshot(db, receipt.ids)) !== receipt.snapshotHash) throw new Error('M5_FIXTURE_CHANGED');
  if (await db.payment.count() || await db.sellerLedgerEntry.count() || await db.affiliateCommission.count()) throw new Error('M5_UNCOLLECTED_FINANCE');
  return { version: VERSION, ids: receipt.ids, snapshotHash: receipt.snapshotHash, seededMigrationHead: receipt.seededMigrationHead, collectedMoney: false };
}
async function seedFixtures(db, pool, env, database) {
  await assertDatabaseIdentity(pool, env, database);
  const passwordHash = await bcrypt.hash(env.M5_FIXTURE_PASSWORD, 10);
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(5051001)");
    const receipts = await tx.$queryRawUnsafe('SELECT payload FROM m5_guard.fixture_receipt WHERE name = $1', VERSION);
    if (receipts.length) return verifyFixtureReceipt(tx, receipts[0].payload);
    // Never adopt or overwrite existing rows, even when they look like test data.
    if (await tx.user.count() || await tx.store.count() || await tx.product.count() || await tx.order.count()) throw new Error('M5_DATABASE_NOT_EMPTY');
    const users = [];
    for (const [name, role, isSeller] of [['buyer', 'CUSTOMER', false], ['seller-a', 'ADMIN', true], ['seller-b', 'ADMIN', true], ['affiliate', 'CUSTOMER', false], ['super-admin', 'SUPER_ADMIN', false]]) {
      users.push(await tx.user.create({ data: { email: `${name}@ezihubb.test`, firstName: 'Synthetic', lastName: name,
        role, isSeller, isEmailVerified: true, backupCodes: [], adminTags: [], passwordHash,
        // Generated local-only password stays in the ignored manifest, never reports.
      } }));
    }
    const stores = [];
    for (const [index, slug] of [[1, 'm5-shop-a'], [2, 'm5-shop-b']]) {
      const store = await tx.store.create({ data: { slug, name: slug, ownerId: users[index].id, status: 'ACTIVE', moderationStatus: 'CLEAN',
        fulfillmentMode: 'MANUAL', aboutPhotoUrls: [], featuredProductIds: [], country: 'US' } });
      await tx.user.update({ where: { id: users[index].id }, data: { storeId: store.id } });
      stores.push(store);
    }
    const category = await tx.category.create({ data: { name: 'M5 synthetic', slug: 'm5-synthetic' } });
    const products = [];
    for (const [name, quantity, trackInventory, productType, shop] of [
      ['last-unit', 1, true, 'PHYSICAL', 0], ['shared-pool', 5, true, 'PHYSICAL', 0],
      ['variant-pool', 20, true, 'PHYSICAL', 0], ['unlimited', null, false, 'PHYSICAL', 1],
      ['digital', null, false, 'DIGITAL', 1], ['shop-b-finite', 10, true, 'PHYSICAL', 1],
    ]) {
      products.push(await tx.product.create({ data: { name: `M5 ${name}`, slug: `m5-${name}`, sku: `M5-${name}`,
        description: 'Synthetic test catalog, no approved print artwork', storeId: stores[shop].id, categoryId: category.id,
        basePrice: '16.99', quantity, trackInventory, productType, isPersonalizable: false, moderationStatus: 'CLEAN',
        primaryColors: [], secondaryColors: [], materials: [], occasions: [], holidayTags: [], recipientTags: [], styles: [], sustainability: [], videoUrls: [] } }));
    }
    const variant = await tx.productVariant.create({ data: { productId: products[2].id, name: 'Last variant', options: { Size: 'S' }, quantity: 1, price: '19.99' } });
    await tx.variationSettings.create({ data: { productId: products[2].id, enableVariations: true, variesBy: ['quantity'] } });
    const affiliate = await tx.affiliateAccount.create({ data: { email: 'affiliate@ezihubb.test', firstName: 'Synthetic', lastName: 'Affiliate',
      userId: users[3].id, referralCode: 'M5SYNTHETIC', status: 'ACTIVE' } });
    await tx.platformSettings.create({ data: { id: 'singleton', freeShippingThreshold: '100.00', regulatoryFeeCountries: [] } });
    const order = await tx.order.create({ data: { orderNumber: 'M5-MANUAL-UNPAID', userId: users[0].id, status: 'CONFIRMED',
      shippingName: 'Synthetic Buyer', shippingAddress: '1 Test Street', shippingCity: 'Test City', shippingZip: '00000', shippingCountry: 'US',
      subtotal: '84.95', shippingCost: '10.00', total: '94.95', note: 'Synthetic uncollected manual request; not capture evidence' } });
    for (const [index, productIndex, quantity, subtotal] of [[0, 1, 2, '33.98'], [1, 5, 3, '50.97']]) {
      const shop = await tx.storeOrder.create({ data: { orderId: order.id, storeId: stores[index].id, status: 'CONFIRMED', subtotal,
        shippingCost: '5.00', platformFee: '0.00', sellerEarnings: '0.00' } });
      await tx.orderItem.create({ data: { orderId: order.id, storeOrderId: shop.id, storeId: stores[index].id,
        productId: products[productIndex].id, quantity, unitPrice: '16.99', productName: products[productIndex].name } });
    }
    const guest = await tx.order.create({ data: { orderNumber: 'M5-GUEST-UNPAID', guestEmail: 'guest@ezihubb.test',
      status: 'PENDING_PAYMENT', shippingCost: '0.00', subtotal: '0.00', total: '0.00' } });
    const ids = { users: users.map(row => row.id), stores: stores.map(row => row.id), products: products.map(row => row.id),
      variants: [variant.id], orders: [order.id, guest.id], affiliates: [affiliate.id], category: category.id };
    for (const id of Object.values(ids).flat()) if (!/^[A-Za-z0-9]{12}$/.test(id)) throw new Error('M5_NANOID_DEFAULT');
    const migrationHead = await tx.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name DESC LIMIT 1');
    if (!migrationHead.length) throw new Error('M5_MIGRATION_HISTORY');
    const receipt = { version: VERSION, ids, snapshotHash: digest(await snapshot(tx, ids)), seededMigrationHead: migrationHead[0].migration_name };
    await tx.$executeRawUnsafe('INSERT INTO m5_guard.fixture_receipt (name,payload) VALUES ($1,$2::jsonb)', VERSION, JSON.stringify(receipt));
    return verifyFixtureReceipt(tx, receipt);
  }, { timeout: 30_000 });
}
module.exports = { VERSION, seedFixtures, verifyFixtureReceipt };
