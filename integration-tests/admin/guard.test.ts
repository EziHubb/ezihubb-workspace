/**
 * Integration tests — Admin auth guard (no token → 401 not 404)
 */
import { api } from '../helpers';

describe('Admin — Auth guard', () => {
  it('GET /admin/orders without token → 401', async () => {
    const res = await api('/admin/orders');
    expect(res.status).toBe(401);
  });

  it('GET /admin/products without token → 401', async () => {
    const res = await api('/admin/products');
    expect(res.status).toBe(401);
  });

  it('GET /admin/customers without token → 401', async () => {
    const res = await api('/admin/customers');
    expect(res.status).toBe(401);
  });
});
