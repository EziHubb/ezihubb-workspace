import { EventEmitter } from 'node:events';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { LinkPreviewService } from './link-preview.service';

jest.mock('./messages.service', () => ({ MessagesService: class {} }));
jest.mock('node:dns/promises', () => ({
  ...jest.requireActual('node:dns/promises'),
  lookup: jest.fn(),
}));
jest.mock('node:http', () => ({
  ...jest.requireActual('node:http'),
  request: jest.fn(),
}));
jest.mock('node:https', () => ({
  ...jest.requireActual('node:https'),
  request: jest.fn(),
}));

interface Reply {
  status?: number;
  location?: string;
  html?: string;
  stall?: boolean;
  oversized?: boolean;
}

function fixture(replies: Reply[] = [{ html: '<title>Public shop</title>' }]) {
  const prisma = { message: { count: jest.fn(async () => 1) } };
  const redis = { get: jest.fn(async () => null), set: jest.fn() };
  const messages = { assertThreadAccess: jest.fn() };
  const service = new LinkPreviewService(
    prisma as never,
    redis as never,
    messages as never,
  );
  const responses: Array<EventEmitter & { destroy: jest.Mock }> = [];
  const requestMock = (
    options: { signal: AbortSignal },
    callback: (res: unknown) => void,
  ) => {
    const req = Object.assign(new EventEmitter(), { end: jest.fn() });
    const reply = replies.shift() ?? {};
    const res = Object.assign(new EventEmitter(), {
      statusCode: reply.status ?? 200,
      headers: { 'content-type': 'text/html', location: reply.location },
      destroy: jest.fn(),
    });
    responses.push(res);
    const abort = () => req.emit('error', new Error('Aborted'));
    options.signal.addEventListener('abort', abort, { once: true });
    res.destroy.mockImplementation(() =>
      options.signal.removeEventListener('abort', abort),
    );
    req.end.mockImplementation(() => {
      callback(res);
      if (reply.stall) return;
      if (reply.oversized) res.emit('data', Buffer.alloc(1024 * 1024, 'a'));
      else
        res.emit(
          'data',
          Buffer.from(reply.html ?? '<title>Public shop</title>'),
        );
      res.emit('end');
    });
    return req;
  };
  jest.mocked(httpRequest).mockImplementation(requestMock as never);
  jest.mocked(httpsRequest).mockImplementation(requestMock as never);
  jest
    .mocked(lookup)
    .mockResolvedValue([{ address: '8.8.8.8', family: 4 }] as never);
  const preview = (url = 'https://public.example.test/item') =>
    service.previewFor('thread', url, { userId: 'viewer', forShop: false });
  return { service, prisma, redis, messages, preview, responses };
}

describe('link preview SSRF and resource boundary', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.useRealTimers());
  it.each([
    '127.0.0.1',
    '169.254.169.254',
    '10.1.2.3',
    '192.168.1.1',
    '100.64.0.1',
    '198.18.0.1',
    '203.0.113.1',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe',
    '0:0:0:0:0:ffff:7f00:1',
    '64:ff9b::7f00:1',
    '2002:7f00:1::1',
    '2001:db8::1',
  ])('refuses DNS result %s before creating a socket', async (address) => {
    const h = fixture();
    jest
      .mocked(lookup)
      .mockResolvedValueOnce([
        { address, family: address.includes(':') ? 6 : 4 },
      ] as never);
    expect(await h.preview()).toBeNull();
    expect(httpsRequest).not.toHaveBeenCalled();
  });
  it('rejects mixed public/private DNS results, not just the first answer', async () => {
    const h = fixture();
    jest.mocked(lookup).mockResolvedValueOnce([
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.1', family: 4 },
    ] as never);
    expect(await h.preview()).toBeNull();
    expect(httpsRequest).not.toHaveBeenCalled();
  });
  it('pins the validated literal IP and preserves Host/SNI with no second lookup', async () => {
    const h = fixture();
    expect(await h.preview()).toMatchObject({ title: 'Public shop' });
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(httpsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        hostname: '8.8.8.8',
        servername: 'public.example.test',
        agent: false,
        headers: expect.objectContaining({ host: 'public.example.test' }),
      }),
      expect.any(Function),
    );
    expect(h.responses[0].destroy).toHaveBeenCalled();
  });
  it('supports native public IPv6 but still connects only to the checked IP', async () => {
    const h = fixture();
    jest
      .mocked(lookup)
      .mockResolvedValueOnce([
        { address: '2001:4860:4860::8888', family: 6 },
      ] as never);
    expect(await h.preview()).toMatchObject({ title: 'Public shop' });
    expect(httpsRequest).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: '2001:4860:4860::8888', family: 6 }),
      expect.any(Function),
    );
  });
  it('revalidates redirects and refuses a redirect to metadata IPv6', async () => {
    const h = fixture([
      { status: 302, location: 'http://[::ffff:a9fe:a9fe]/latest/meta-data/' },
    ]);
    expect(await h.preview()).toBeNull();
    expect(httpsRequest).toHaveBeenCalledTimes(1);
    expect(httpRequest).not.toHaveBeenCalled();
  });
  it('applies the five-second deadline while waiting for response body, not just headers', async () => {
    jest.useFakeTimers();
    const h = fixture([{ stall: true }]);
    const work = h.preview();
    await jest.advanceTimersByTimeAsync(5001);
    expect(await work).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('bounds a stalled DNS lookup within the same deadline', async () => {
    jest.useFakeTimers();
    const h = fixture();
    jest.mocked(lookup).mockReturnValueOnce(new Promise(() => undefined));
    const work = h.preview();
    await jest.advanceTimersByTimeAsync(5001);
    expect(await work).toBeNull();
    expect(httpsRequest).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
  it('caps retained response bytes and closes an oversized stream', async () => {
    const h = fixture([{ oversized: true }]);
    expect(await h.preview()).toBeNull();
    expect(h.responses[0].destroy).toHaveBeenCalled();
  });
  it('checks thread ownership before DNS, networking or cached previews', async () => {
    const h = fixture();
    h.messages.assertThreadAccess.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(h.preview()).rejects.toThrow('Forbidden');
    expect(h.redis.get).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });
});
