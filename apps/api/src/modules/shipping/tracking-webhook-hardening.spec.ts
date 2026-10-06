import { TrackingWebhookController } from './tracking-webhook.controller';
import { createHmac } from 'node:crypto';

describe('Tracking webhook trust boundary', () => {
  function fixture(secret = 'sandbox-secret') {
    const tracking = { parseWebhookEvent: jest.fn().mockReturnValue(null) };
    const prisma = { order: { findFirst: jest.fn() } };
    const controller = new TrackingWebhookController(tracking as never, prisma as never, {} as never, { get: () => secret } as never);
    return { controller, tracking, prisma };
  }
  const rawBody = Buffer.from('{"type":"tracker.updated"}');
  const signature = createHmac('sha256', 'sandbox-secret').update(rawBody).digest('hex');
  it.each([
    { secret: '', rawBody, signature },
    { secret: 'sandbox-secret', rawBody: undefined, signature },
    { secret: 'sandbox-secret', rawBody, signature: undefined },
    { secret: 'sandbox-secret', rawBody, signature: 'bad' },
    { secret: 'sandbox-secret', rawBody, signature: '0'.repeat(64) },
  ])('rejects unverifiable event before any lookup: %j', async (input) => {
    const { controller, tracking, prisma } = fixture(input.secret);
    await expect(controller.handleWebhook({ body: {}, rawBody: input.rawBody, headers: { 'x-hmac-signature': input.signature } } as never)).rejects.toThrow();
    expect(tracking.parseWebhookEvent).not.toHaveBeenCalled();
    expect(prisma.order.findFirst).not.toHaveBeenCalled();
  });
  it('accepts existing HMAC protocol only over exact raw bytes', async () => {
    const { controller, tracking } = fixture();
    await expect(controller.handleWebhook({ body: {}, rawBody, headers: { 'x-hmac-signature': signature } } as never)).resolves.toEqual({ received: true });
    expect(tracking.parseWebhookEvent).toHaveBeenCalledTimes(1);
    await expect(controller.handleWebhook({ body: {}, rawBody: Buffer.from('different'), headers: { 'x-hmac-signature': signature } } as never)).rejects.toThrow();
  });
  it('accepts the documented EasyPost algorithm-prefixed signature', async () => {
    const { controller } = fixture();
    await expect(controller.handleWebhook({ body: {}, rawBody, headers: { 'x-hmac-signature': `hmac-sha256-hex=${signature}` } } as never)).resolves.toEqual({ received: true });
  });
});
