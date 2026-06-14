/**
 * Integration tests — Loyalty, coins, VIP, store credits
 */
import { api, login, expectAlive } from '../helpers';

const EMAIL    = process.env['TEST_USER_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
});
const skip = () => !token;

describe('Loyalty', () => {
  it('GET /loyalty/me', async () => {
    if (skip()) return;
    const res = await api('/loyalty/me', { token });
    expectAlive(res, 'GET /loyalty/me');
  });

  it('GET /loyalty/preview', async () => {
    if (skip()) return;
    const res = await api('/loyalty/preview?orderTotal=100', { token });
    expectAlive(res, 'GET /loyalty/preview');
  });
});

describe('Coins', () => {
  it('GET /coins/me', async () => {
    if (skip()) return;
    const res = await api('/coins/me', { token });
    expectAlive(res, 'GET /coins/me');
  });

  it('GET /coins/me/history', async () => {
    if (skip()) return;
    const res = await api('/coins/me/history', { token });
    expectAlive(res, 'GET /coins/me/history');
  });
});

describe('VIP', () => {
  it('GET /vip/me', async () => {
    if (skip()) return;
    const res = await api('/vip/me', { token });
    expectAlive(res, 'GET /vip/me');
  });
});

describe('Store credits', () => {
  it('GET /store-credits/me', async () => {
    if (skip()) return;
    const res = await api('/store-credits/me', { token });
    expectAlive(res, 'GET /store-credits/me');
  });
});
