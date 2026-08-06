/**
 * Integration tests — Affiliates, referrals, creators, seller onboarding (auth required)
 */
import { api, login } from '../helpers';

const EMAIL    = process.env['TEST_USER_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
});
const skip = () => !token;

describe('Affiliates & Referrals', () => {
  it('GET /affiliates/me', async () => {
    if (skip()) return;
    const res = await api('/affiliates/me', { token });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
  });

  it('GET /referrals/me', async () => {
    if (skip()) return;
    const res = await api('/referrals/me', { token });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
  });

  it('GET /creators/me', async () => {
    if (skip()) return;
    const res = await api('/creators/me', { token });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
  });
});

describe('Seller onboarding', () => {
  it('GET /stores/me/application', async () => {
    if (skip()) return;
    const res = await api('/stores/me/application', { token });
    expect(res.status).not.toBe(500);
    expect(res.status).not.toBe(404);
  });
});
