/**
 * Integration tests — Public review endpoints
 */
import { api, expectAlive, expectList } from '../helpers';

describe('Reviews — public', () => {
  it('GET /reviews', async () => {
    const res = await api('/reviews?limit=5');
    expectList(res, 'GET /reviews');
  });

  it('GET /reviews/summary', async () => {
    const res = await api('/reviews/summary');
    expectAlive(res, 'GET /reviews/summary');
  });
});
