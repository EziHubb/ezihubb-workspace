/**
 * Integration tests — Authenticated user profile, addresses, wishlist
 */
import { api, login, expectAlive } from '../helpers';

const EMAIL    = process.env['TEST_USER_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
  else console.warn('⚠  TEST_USER_EMAIL / TEST_USER_PASSWORD not set — skipping user tests');
});
const skip = () => !token;

describe('User — profile', () => {
  it('GET /users/me', async () => {
    if (skip()) return;
    const res = await api('/users/me', { token });
    expect(res.status).toBe(200);
    const b = res.body as Record<string, unknown>;
    const user = (b?.['data'] ?? b) as Record<string, unknown>;
    expect(user?.['email']).toBeTruthy();
  });

  it('GET /users/me/addresses', async () => {
    if (skip()) return;
    const res = await api('/users/me/addresses', { token });
    expectAlive(res, 'GET /users/me/addresses');
  });

  it('GET /users/me/wishlist', async () => {
    if (skip()) return;
    const res = await api('/users/me/wishlist', { token });
    expectAlive(res, 'GET /users/me/wishlist');
  });

  it('GET /users/me/orders', async () => {
    if (skip()) return;
    const res = await api('/users/me/orders', { token });
    expectAlive(res, 'GET /users/me/orders');
  });
});

describe('User — reviews', () => {
  it('GET /reviews/me', async () => {
    if (skip()) return;
    const res = await api('/reviews/me', { token });
    expectAlive(res, 'GET /reviews/me');
  });

  it('GET /reviews/me/reviewable-products', async () => {
    if (skip()) return;
    const res = await api('/reviews/me/reviewable-products', { token });
    expectAlive(res, 'GET /reviews/me/reviewable-products');
  });
});
