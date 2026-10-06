import { LoggingInterceptor } from './logging.interceptor';
import { lastValueFrom, of, throwError } from 'rxjs';

describe('HTTP diagnostic privacy', () => {
  it.each([false, true])('retains route/correlation but redacts URL/PII/error on failure=%s', async (failed) => {
    const interceptor = new LoggingInterceptor();
    const logger = { log: jest.fn(), error: jest.fn() };
    Object.assign(interceptor, { logger });
    const req = { method: 'GET', route: { path: '/orders/:id' }, url: '/orders/PRIVATE?token=SECRET', ip: 'PRIVATE-IP', headers: { 'user-agent': 'PRIVATE-UA' }, requestId: 'correlation-id' };
    const ctx = { switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ statusCode: 200 }) }) };
    const result = lastValueFrom(interceptor.intercept(ctx as never, { handle: () => failed ? throwError(() => new Error('SECRET')) : of({ ok: true }) }));
    if (failed) await expect(result).rejects.toThrow(); else await result;
    const output = JSON.stringify([logger.log.mock.calls, logger.error.mock.calls]);
    expect(output).toContain('/orders/:id');
    expect(output).toContain('correlation-id');
    expect(output).not.toMatch(/PRIVATE|SECRET/);
  });
});
