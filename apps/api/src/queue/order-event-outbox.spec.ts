import {
  OrderEventOutboxService,
  recordOrderEvent,
} from './order-event-outbox.service';

function fixture(eventType = 'ORDER_PAID') {
  const row = {
    id: 'intent',
    eventType,
    orderId: 'order',
    state: 'PENDING',
    attempts: 0,
    nextAttemptAt: new Date(0),
    leaseToken: null as string | null,
    leaseUntil: null as Date | null,
  };
  const order = {
    id: 'order',
    orderNumber: 'SYNTHETIC',
    status: 'DELIVERED',
    adminArchivedAt: null,
    deliveredAt: new Date(),
    guestEmail: 'buyer@example.test',
    user: null,
    items: [],
    payment: { status: 'PAID' },
    economicContext: null,
  };
  const prisma = {
    order: { findUnique: jest.fn(async () => order) },
    orderEventOutbox: {
      findMany: jest.fn(async () =>
        row.state === 'PENDING' && row.nextAttemptAt <= new Date()
          ? [{ ...row }]
          : [],
      ),
      createMany: jest.fn(),
      updateMany: jest.fn(async ({ where, data }) => {
        if (
          row.state !== where.state ||
          ('leaseToken' in where && row.leaseToken !== where.leaseToken)
        )
          return { count: 0 };
        if (where.OR && row.leaseUntil && row.leaseUntil > new Date())
          return { count: 0 };
        const { attempts, ...fields } = data;
        Object.assign(row, fields);
        if (attempts) row.attempts += attempts.increment;
        return { count: 1 };
      }),
    },
  };
  const events = { publish: jest.fn() };
  const mail = { add: jest.fn() };
  const service = new OrderEventOutboxService(
    prisma as never,
    events as never,
    mail as never,
  );
  return { row, order, prisma, events, mail, service };
}

describe('prospective order outbox queue handoff', () => {
  const originalDisableQueue = process.env['DISABLE_QUEUE'];
  beforeEach(() => {
    delete process.env['DISABLE_QUEUE'];
  });
  afterEach(() => {
    if (originalDisableQueue === undefined) delete process.env['DISABLE_QUEUE'];
    else process.env['DISABLE_QUEUE'] = originalDisableQueue;
  });
  it('writes one reference-only intent through the provided transaction', async () => {
    const h = fixture();
    await recordOrderEvent(h.prisma as never, 'ORDER_PAID', 'order');
    expect(h.prisma.orderEventOutbox.createMany).toHaveBeenCalledWith({
      data: [{ eventType: 'ORDER_PAID', orderId: 'order' }],
      skipDuplicates: true,
    });
    expect(h.events.publish).not.toHaveBeenCalled();
  });
  it('restarts from committed pending work and acknowledges only after queue acceptance', async () => {
    const h = fixture();
    await h.service.tick();
    expect(h.events.publish).toHaveBeenCalledWith('order.paid', 'order');
    expect(h.row.state).toBe('QUEUED');
    await h.service.tick();
    expect(h.events.publish).toHaveBeenCalledTimes(1);
  });
  it('retains a pending intent when Redis fails and retries on a later tick', async () => {
    const h = fixture();
    h.events.publish.mockRejectedValueOnce(new Error('Redis unavailable'));
    await h.service.tick();
    expect(h.row.state).toBe('PENDING');
    expect(h.row.leaseToken).toBeNull();
    expect(h.row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    h.row.nextAttemptAt = new Date(0);
    await h.service.tick();
    expect(h.row.state).toBe('QUEUED');
    expect(h.events.publish).toHaveBeenCalledTimes(2);
  });
  it('retries the same retained delivery ID if queue acceptance precedes a failed DB acknowledgement', async () => {
    const h = fixture('ORDER_DELIVERED');
    const update = h.prisma.orderEventOutbox.updateMany.getMockImplementation();
    if (!update) throw new Error('Fixture update implementation is missing');
    h.prisma.orderEventOutbox.updateMany.mockImplementation(async (args) => {
      if (args.data.state === 'QUEUED')
        throw new Error('DB acknowledgement unavailable');
      return update(args);
    });
    await h.service.tick();
    expect(h.mail.add).toHaveBeenCalledTimes(1);
    expect(h.row.state).toBe('PENDING');
    h.prisma.orderEventOutbox.updateMany.mockImplementation(update);
    h.row.nextAttemptAt = new Date(0);
    await h.service.tick();
    expect(h.row.state).toBe('QUEUED');
    expect(h.mail.add.mock.calls.map((call) => call[2])).toEqual([
      expect.objectContaining({
        jobId: 'order-delivered--order',
        removeOnComplete: false,
      }),
      expect.objectContaining({
        jobId: 'order-delivered--order',
        removeOnComplete: false,
      }),
    ]);
  });
  it('recovers a lease abandoned by a crashed dispatcher', async () => {
    const h = fixture();
    h.row.leaseToken = 'dead-process';
    h.row.leaseUntil = new Date(0);
    await h.service.tick();
    expect(h.row.state).toBe('QUEUED');
  });
  it('does not steal an active lease from another instance', async () => {
    const h = fixture();
    h.row.leaseToken = 'other-process';
    h.row.leaseUntil = new Date(Date.now() + 60_000);
    await h.service.tick();
    expect(h.events.publish).not.toHaveBeenCalled();
  });
  it('two dispatcher instances claim one intent (CAS unit model, not native PG)', async () => {
    const h = fixture();
    const other = new OrderEventOutboxService(
      h.prisma as never,
      h.events as never,
      h.mail as never,
    );
    await Promise.all([h.service.tick(), other.tick()]);
    expect(h.events.publish).toHaveBeenCalledTimes(1);
  });
  it('queues delivery with a stable retained ID and no amount/financial mutation', async () => {
    const h = fixture('ORDER_DELIVERED');
    await h.service.tick();
    expect(h.mail.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({
        to: 'buyer@example.test',
        template: 'order-delivered',
      }),
      expect.objectContaining({
        jobId: 'order-delivered--order',
        removeOnComplete: false,
        removeOnFail: false,
      }),
    );
    expect(h.events.publish).not.toHaveBeenCalled();
    expect(h.row.state).toBe('QUEUED');
  });
  it('leaves committed work pending when queues are disabled instead of acknowledging a no-op queue', async () => {
    process.env['DISABLE_QUEUE'] = 'true';
    const h = fixture();
    await h.service.tick();
    expect(h.prisma.orderEventOutbox.findMany).not.toHaveBeenCalled();
    expect(h.row.state).toBe('PENDING');
  });
  it('does not reconstruct intents by scanning historical orders', async () => {
    const h = fixture();
    h.prisma.orderEventOutbox.findMany.mockResolvedValueOnce([]);
    await h.service.tick();
    expect(h.prisma.order.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.orderEventOutbox.createMany).not.toHaveBeenCalled();
  });
  it('records an explicit skip for a removed order', async () => {
    const h = fixture();
    h.prisma.order.findUnique.mockResolvedValueOnce(null as never);
    await h.service.tick();
    expect(h.row.state).toBe('SKIPPED');
    expect(h.events.publish).not.toHaveBeenCalled();
  });
  it('does not replay legacy paid consumers into a versioned economic order', async () => {
    const h = fixture();
    h.order.economicContext = { id: 'context' } as never;
    await h.service.tick();
    expect(h.events.publish).not.toHaveBeenCalled();
    expect(h.row.state).toBe('SKIPPED');
  });
  it('bounds a hung queue operation and preserves its durable intent', async () => {
    jest.useFakeTimers();
    try {
      const h = fixture();
      h.events.publish.mockReturnValueOnce(new Promise(() => undefined));
      const work = h.service.tick();
      await jest.advanceTimersByTimeAsync(20_001);
      await work;
      expect(h.row.state).toBe('PENDING');
      expect(h.row.leaseToken).toBeNull();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
