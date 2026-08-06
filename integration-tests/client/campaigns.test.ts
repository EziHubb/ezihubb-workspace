/**
 * Integration tests — Campaigns
 */
import { api, expectAlive } from '../helpers';

describe('Campaigns', () => {
  it('GET /campaigns/active', async () => {
    const res = await api('/campaigns/active');
    expectAlive(res, 'GET /campaigns/active');
  });
});
