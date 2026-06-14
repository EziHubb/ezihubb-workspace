/**
 * Integration tests — Gift pools, chains, blind match, affiliates (auth required)
 */
import { api, login, expectAlive } from '../helpers';

const EMAIL    = process.env['TEST_USER_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
});
const skip = () => !token;

describe('Gift features', () => {
  it('GET /gift-pools/my', async () => {
    if (skip()) return;
    const res = await api('/gift-pools/my', { token });
    expectAlive(res, 'GET /gift-pools/my');
  });

  it('GET /gift-chains/my', async () => {
    if (skip()) return;
    const res = await api('/gift-chains/my', { token });
    expectAlive(res, 'GET /gift-chains/my');
  });

  it('GET /blind-match/history', async () => {
    if (skip()) return;
    const res = await api('/blind-match/history', { token });
    expectAlive(res, 'GET /blind-match/history');
  });
});

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
