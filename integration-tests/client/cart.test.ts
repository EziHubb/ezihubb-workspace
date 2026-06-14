/**
 * Integration tests — Cart (auth required)
 */
import { api, login, expectAlive } from '../helpers';

const EMAIL    = process.env['TEST_USER_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
});
const skip = () => !token;

describe('Cart', () => {
  it('GET /cart', async () => {
    if (skip()) return;
    const res = await api('/cart', { token });
    expectAlive(res, 'GET /cart');
    expect(res.status).toBe(200);
  });
});
