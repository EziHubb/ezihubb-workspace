/**
 * Integration tests — Flash deals, campaigns, blind match
 */
import { api, expectAlive } from '../helpers';

describe('Flash Deals & Campaigns', () => {
  it('GET /flash-deals/active', async () => {
    const res = await api('/flash-deals/active');
    expectAlive(res, 'GET /flash-deals/active');
  });

  it('GET /campaigns/active', async () => {
    const res = await api('/campaigns/active');
    expectAlive(res, 'GET /campaigns/active');
  });
});

describe('Blind Match — public', () => {
  it('GET /blind-match/hall-of-fame', async () => {
    const res = await api('/blind-match/hall-of-fame');
    expectAlive(res, 'GET /blind-match/hall-of-fame');
  });

  it('GET /blind-match/ugc', async () => {
    const res = await api('/blind-match/ugc');
    expectAlive(res, 'GET /blind-match/ugc');
  });
});
