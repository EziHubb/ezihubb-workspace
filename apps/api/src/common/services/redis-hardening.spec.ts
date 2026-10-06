import { RedisService } from './redis.service';
import Redis from 'ioredis';
import { ServiceUnavailableException } from '@nestjs/common';
jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn() }));

describe('Recoverable cache connection', () => {
  it('keeps optional cache available as a fallback but fails closed for security operations', async () => {
    const service = new RedisService({} as never);
    await expect(service.get('cache')).resolves.toBeNull();
    await expect(service.getSecurityCounter('lock')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.incrementSecurityCounter('lock', 900)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.clearSecurityCounter('lock')).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.claimSecurityToken('challenge', 300)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('fails closed on command errors or corrupt counters without leaking Redis error details', async () => {
    const client = { get: jest.fn().mockRejectedValueOnce(new Error('private connection string')).mockResolvedValueOnce('invalid') };
    const service = new RedisService({} as never);
    Object.assign(service, { client, available: true });
    await expect(service.getSecurityCounter('lock')).rejects.toThrow('Sign-in is temporarily unavailable');
    await expect(service.getSecurityCounter('lock')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('increments with atomic expiry and claims a challenge only once', async () => {
    const client = { eval: jest.fn().mockResolvedValue(1), set: jest.fn().mockResolvedValueOnce('OK').mockResolvedValueOnce(null) };
    const service = new RedisService({} as never);
    Object.assign(service, { client, available: true });
    await expect(service.incrementSecurityCounter('lock', 900)).resolves.toBe(1);
    expect(client.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('EXPIRE'"), 1, 'lock', 900);
    await expect(service.claimSecurityToken('challenge', 300)).resolves.toBe(true);
    await expect(service.claimSecurityToken('challenge', 300)).resolves.toBe(false);
    expect(client.set).toHaveBeenCalledWith('challenge', '1', 'EX', 300, 'NX');
  });
  it('reconnects with capped delay, becomes available on ready and stops retrying at shutdown', async () => {
    const events: Record<string, () => void> = {};
    const client = { on: jest.fn((name: string, fn: () => void) => { events[name] = fn; }), connect: jest.fn().mockRejectedValue(new Error('offline')),
      quit: jest.fn().mockRejectedValue(new Error('offline')), disconnect: jest.fn() };
    jest.mocked(Redis).mockImplementation(() => client as never);
    const service = new RedisService({ get: () => 'redis://example.test:6379' } as never);
    await service.onModuleInit();
    expect(service.isAvailable()).toBe(false);
    const calls = jest.mocked(Redis).mock.calls as unknown as [string, { retryStrategy: (attempt: number) => number }][];
    const options = calls[0][1];
    expect(options.retryStrategy(1)).toBeGreaterThan(0);
    expect(options.retryStrategy(1000)).toBe(5000);
    events.ready(); expect(service.isAvailable()).toBe(true);
    events.close(); expect(service.isAvailable()).toBe(false);
    await service.onModuleDestroy();
    expect(client.disconnect).toHaveBeenCalled();
  });
  it('invalidates through cursor pages, never KEYS', async () => {
    const client = { scan: jest.fn().mockResolvedValueOnce(['10', ['cache:1']]).mockResolvedValueOnce(['0', ['cache:2']]), del: jest.fn(), keys: jest.fn() };
    const service = new RedisService({} as never);
    Object.assign(service, { client, available: true });
    await service.invalidatePattern('cache:*');
    expect(client.scan).toHaveBeenNthCalledWith(2, '10', 'MATCH', 'cache:*', 'COUNT', 100);
    expect(client.del).toHaveBeenCalledTimes(2);
    expect(client.keys).not.toHaveBeenCalled();
  });
});
