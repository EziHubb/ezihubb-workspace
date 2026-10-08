import { ConfigService } from '@nestjs/config';
import { EconomicExternalEffect } from '@prisma/client';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { EncryptionService } from '../../common/services/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EconomicExternalEffectsService } from './economic-external-effects.service';
import { externalEffectHash } from './economic-external-effect';
import { buildEconomicQuote, quoteFingerprint } from './economic-quote';

jest.mock('axios', () => ({ __esModule: true, default: { create: jest.fn() } }));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
jest.mock('./economic-fulfillment-guard', () => ({ assertEconomicShopFulfillmentAllowed: jest.fn(async () => true) }));
const snapshot = buildEconomicQuote({ orderId: 'order', currency: 'USD', minorExponent: 2,
  stores: [{ storeId: 'store', storeOrderId: 'shop', lines: [{ id: 'line', productId: 'product', variantId: null,
    quantity: 1, unitPriceMinor: '100', sellerDiscountMinor: '0', platformDiscountMinor: '0' }],
    customerShippingMinor: '0', expectedShippingSubsidyMinor: '0', giftWrapMinor: '0', fees: [] }],
  tax: { amountMinor: '0', ruleReference: 'synthetic' }, affiliate: null });
function harness(flags = true) {
  const context = { id: 'ctx', orderId: 'order', provenance: 'LIVE', quote: snapshot, quoteHash: quoteFingerprint(snapshot) };
  const shop = { id: 'shop', orderId: 'order', storeId: 'store', store: { fulfillmentMode: 'AUTOMATIC' }, items: [
    { id: 'line', productId: 'product', variantId: null, quantity: 1, customizationData: null, previewUrl: null }], order: {
    economicContext: context, user: { email: 'buyer@example.test' }, shippingName: 'Buyer Name', shippingAddress: 'Street',
    shippingCity: 'City', shippingZip: '12345', shippingCountry: 'US', shippingState: 'TX', shippingPhone: null } };
  const connection = { id: 'conn', storeId: 'store', status: 'ACTIVE', provider: 'PRINTIFY', externalShopId: '123', encryptedApiKey: 'synthetic-encrypted-not-a-key' };
  const rows: Record<string, unknown>[] = [];
  const tx = { $queryRaw: jest.fn(), storeOrder: { findUniqueOrThrow: jest.fn(async () => shop) },
    economicOrderContext: { findUniqueOrThrow: jest.fn(async () => context) },
    storeOrderFulfillment: { count: jest.fn(async () => 0) }, economicRefund: { count: jest.fn(async () => 0) },
    productFulfillmentMapping: { findMany: jest.fn(async () => [{ connection, externalProductId: 'external', externalVariantId: '1' }]) },
    storeFulfillmentConnection: { findUniqueOrThrow: jest.fn(async () => connection) },
    economicExternalEffect: { findMany: jest.fn(async () => rows), count: jest.fn(async () => rows.length),
      create: jest.fn(async ({ data }) => { const row = { id: 'effect', state: 'PREPARED', context, ...data }; rows.push(row); return row; }),
      findUniqueOrThrow: jest.fn(async () => ({ ...rows[0] })), updateMany: jest.fn(async ({ where, data }) => {
        const row = rows.find(item => item.id === where.id);
        if (!row || (typeof where.state === 'string' ? row.state !== where.state : !where.state.in.includes(row.state))) return { count: 0 };
        Object.assign(row, data); return { count: 1 };
      }) } };
  const prisma = { ...tx, $transaction: jest.fn(async work => work(tx)) };
  const config = new ConfigService({ ECONOMIC_POD_ENABLED: String(flags), ECONOMIC_EMAIL_ENABLED: String(flags),
    email: { host: 'smtp.example.test', from: 'orders@example.test', port: 587 } });
  const encryption = { decrypt: jest.fn(() => 'synthetic-token-not-real') };
  const service = new EconomicExternalEffectsService(prisma as unknown as PrismaService, config, encryption as unknown as EncryptionService);
  const client = { get: jest.fn(), post: jest.fn() }; jest.mocked(axios.create).mockReturnValue(client as never);
  return { service, rows, tx, prisma, shop, connection, context, client, encryption };
}
describe('external adapters are separately gated and bound to original evidence', () => {
  const previousEnabled = process.env['ECONOMIC_V1_ENABLED'], previousMode = process.env['ECONOMIC_V1_MODE'];
  beforeEach(() => { jest.clearAllMocks(); process.env['ECONOMIC_V1_ENABLED'] = 'true'; process.env['ECONOMIC_V1_MODE'] = 'LIVE'; });
  afterEach(() => {
    if (previousEnabled === undefined) delete process.env['ECONOMIC_V1_ENABLED']; else process.env['ECONOMIC_V1_ENABLED'] = previousEnabled;
    if (previousMode === undefined) delete process.env['ECONOMIC_V1_MODE']; else process.env['ECONOMIC_V1_MODE'] = previousMode;
  });
  it('default-off and TEST modes cannot use live POD or SMTP connections', async () => {
    const h = harness(false); await expect(h.service.preparePod('shop', 'operator', 'LIVE', 'Audit')).rejects.toThrow('not enabled');
    await h.service.tick(); expect(h.prisma.economicExternalEffect.findMany).not.toHaveBeenCalled();
    const test = harness(); expect(test.service.podEnabled('TEST')).toBe(false);
    process.env['ECONOMIC_V1_MODE'] = 'TEST'; expect(test.service.podEnabled('LIVE')).toBe(false);
    await test.service.tick(); expect(nodemailer.createTransport).not.toHaveBeenCalled(); expect(axios.create).not.toHaveBeenCalled();
  });
  it('freezes complete owned mappings/address once and never rebuilds on preparation replay', async () => {
    const h = harness(); expect(await h.service.preparePod('shop', 'operator', 'LIVE', 'Original shop')).toEqual({ ids: ['effect'], alreadyPrepared: false });
    expect(h.rows[0]).toMatchObject({ kind: 'POD_PRINTIFY', connectionId: 'conn', requestedBy: 'operator', payload: {
      version: 'pod-v1', address: { country: 'US', zip: '12345' }, items: [{ lineId: 'line', externalProductId: 'external', externalVariantId: 1, quantity: 1 }] } });
    h.connection.status = 'DISCONNECTED'; h.shop.items[0].quantity = 2;
    expect(await h.service.preparePod('shop', 'operator', 'LIVE', 'Recover original')).toEqual({ ids: ['effect'], alreadyPrepared: true });
    expect(h.tx.productFulfillmentMapping.findMany).toHaveBeenCalledTimes(1); expect(axios.create).not.toHaveBeenCalled();
  });
  it('does not guess personalized artwork, incomplete mappings or refunded/legacy handoff state', async () => {
    const h = harness(); h.shop.items[0].customizationData = { name: 'Buyer' } as never;
    await expect(h.service.preparePod('shop', 'operator', 'LIVE', 'Audit')).rejects.toThrow('artwork');
    h.shop.items[0].customizationData = null; h.tx.productFulfillmentMapping.findMany.mockResolvedValue([]);
    await expect(h.service.preparePod('shop', 'operator', 'LIVE', 'Audit')).rejects.toThrow('exactly one');
    h.tx.economicRefund.count.mockResolvedValue(1);
    await expect(h.service.preparePod('shop', 'operator', 'LIVE', 'Audit')).rejects.toThrow('refunded');
    h.tx.economicRefund.count.mockResolvedValue(0); h.tx.storeOrderFulfillment.count.mockResolvedValue(1);
    await expect(h.service.preparePod('shop', 'operator', 'LIVE', 'Audit')).rejects.toThrow('attempt'); expect(h.rows).toHaveLength(0);
  });
  it('sends one original POST and independently reads the exact original resource', async () => {
    const h = harness(); await h.service.preparePod('shop', 'operator', 'LIVE', 'Audit');
    const payload = h.rows[0].payload as { address: unknown };
    h.client.get.mockResolvedValueOnce({ data: [{ id: 123 }] }).mockResolvedValueOnce({ data: { id: 'original', address_to: payload.address,
      line_items: [{ product_id: 'external', variant_id: 1, quantity: 1, metadata: { external_id: 'effect-line' } }] } });
    h.client.post.mockResolvedValue({ data: { id: 'original' } });
    await expect(h.service.executePod('effect', 'LIVE')).resolves.toMatchObject({ state: 'SUCCEEDED', providerReference: 'original' });
    expect(h.client.post).toHaveBeenCalledTimes(1); expect(h.client.post).toHaveBeenCalledWith('/shops/123/orders.json', expect.objectContaining({ external_id: 'effect',
      line_items: [{ product_id: 'external', variant_id: 1, quantity: 1, external_id: 'effect-line' }], send_shipping_notification: false }));
    expect(h.client.get).toHaveBeenLastCalledWith('/shops/123/orders/original.json');
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ maxRedirects: 0, timeout: 10_000 }));
  });
  it('rejects a disconnected/foreign original connection before any HTTP client or decryption', async () => {
    const h = harness(); await h.service.preparePod('shop', 'operator', 'LIVE', 'Audit'); h.connection.storeId = 'foreign';
    await expect(h.service.executePod('effect', 'LIVE')).rejects.toThrow('connection');
    expect(h.encryption.decrypt).not.toHaveBeenCalled(); expect(axios.create).not.toHaveBeenCalled();
  });
  it('lists only scoped reference metadata, never original shipping/customer payload', async () => {
    const h = harness(); await h.service.preparePod('shop', 'operator', 'LIVE', 'Audit');
    const report = await h.service.list({ provenance: 'LIVE', currency: 'USD', page: 1, limit: 20, kind: 'POD_PRINTIFY', orderId: 'order' });
    expect(h.tx.economicExternalEffect.count).toHaveBeenCalledWith({ where: { context: { provenance: 'LIVE', currency: 'USD', orderId: 'order' }, kind: 'POD_PRINTIFY' } });
    expect(report.data[0]).not.toHaveProperty('payload'); expect(report.data[0]).not.toHaveProperty('providerAccount');
    expect(JSON.stringify(report)).not.toContain('buyer@example.test');
  });
  it('claims SMTP once before I/O; verified acceptance is not an inbox-delivery claim', async () => {
    const h = harness(), payload = { version: 'notification-v1', to: 'buyer@example.test', subject: 'Synthetic verification', text: 'Original receipt' };
    h.rows.push({ id: 'email', kind: 'EMAIL_TRANSACTIONAL', state: 'PREPARED', providerAccount: h.service.smtpAccount(), payload, payloadHash: externalEffectHash(payload) });
    const sendMail = jest.fn(async () => { expect(h.rows[0].state).toBe('DISPATCHED'); return { accepted: [payload.to], rejected: [] }; });
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
    // Private worker is exercised with synthetic transport, never real SMTP.
    await (h.service as unknown as { sendEmail(effect: EconomicExternalEffect): Promise<void> }).sendEmail(h.rows[0] as EconomicExternalEffect);
    expect(h.rows[0]).toMatchObject({ state: 'SUCCEEDED', providerReference: 'smtp-email', evidenceHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    await (h.service as unknown as { sendEmail(effect: EconomicExternalEffect): Promise<void> }).sendEmail(h.rows[0] as EconomicExternalEffect);
    expect(sendMail).toHaveBeenCalledTimes(1); expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ messageId: '<economic-email@ezihubb.com>' }));
  });
  it('an ambiguous SMTP timeout is held permanently, not put back in a retry queue', async () => {
    const h = harness(), payload = { version: 'notification-v1', to: 'buyer@example.test', subject: 'Synthetic', text: 'Receipt' };
    h.rows.push({ id: 'email', kind: 'EMAIL_TRANSACTIONAL', state: 'PREPARED', providerAccount: h.service.smtpAccount(), payload, payloadHash: externalEffectHash(payload) });
    const sendMail = jest.fn(async () => { throw new Error('SMTP timeout after acceptance'); });
    jest.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
    const worker = h.service as unknown as { sendEmail(effect: EconomicExternalEffect): Promise<void> };
    await expect(worker.sendEmail(h.rows[0] as EconomicExternalEffect)).rejects.toThrow('timeout'); expect(h.rows[0].state).toBe('NEEDS_RECONCILIATION');
    await worker.sendEmail(h.rows[0] as EconomicExternalEffect); expect(sendMail).toHaveBeenCalledTimes(1);
  });
  it('changed SMTP account cannot send a frozen recipient intent', async () => {
    const h = harness(), payload = { version: 'notification-v1', to: 'buyer@example.test', subject: 'Synthetic', text: 'Receipt' };
    const row = { id: 'email', state: 'PREPARED', providerAccount: 'foreign', payload, payloadHash: externalEffectHash(payload) } as unknown as EconomicExternalEffect;
    await expect((h.service as unknown as { sendEmail(effect: EconomicExternalEffect): Promise<void> }).sendEmail(row)).rejects.toThrow('binding');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
});
