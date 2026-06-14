/**
 * Integration tests — Buyer orders (auth required)
 */
import { api, login, expectAlive } from '../helpers';

const EMAIL    = process.env['TEST_USER_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
});
const skip = () => !token;

describe('Orders — buyer', () => {
  it('GET /orders/me', async () => {
    if (skip()) return;
    const res = await api('/orders/me', { token });
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(500);
  });
});
