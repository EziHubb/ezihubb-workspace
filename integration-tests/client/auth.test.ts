/**
 * Integration tests — Authentication (login / token)
 */
import { api } from '../helpers';

const EMAIL    = process.env['TEST_USER_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

describe('Auth — login', () => {
  it('POST /auth/login returns accessToken', async () => {
    if (!EMAIL || !PASSWORD) return;
    const res = await api('/auth/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
    expect(res.status).toBe(200);
    const body = res.body as Record<string, unknown>;
    const data = body?.['data'] as Record<string, unknown> | undefined;
    const token = data?.['accessToken'] ?? body?.['accessToken'];
    expect(typeof token).toBe('string');
  });

  it('POST /auth/login with bad credentials → 401', async () => {
    const res = await api('/auth/login', { method: 'POST', body: { email: 'bad@test.com', password: 'wrong' } });
    expect([400, 401]).toContain(res.status);
  });
});
