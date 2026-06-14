/**
 * Integration tests — Search endpoints
 */
import { api, expectAlive, expectList } from '../helpers';

describe('Search', () => {
  it('GET /search?q=mug', async () => {
    const res = await api('/search?q=mug');
    expectList(res, 'GET /search?q=mug');
  });

  it('GET /search/autocomplete?q=mug', async () => {
    const res = await api('/search/autocomplete?q=mug');
    expectAlive(res, 'GET /search/autocomplete?q=mug');
  });

  it('GET /search/trending', async () => {
    const res = await api('/search/trending');
    expectAlive(res, 'GET /search/trending');
  });

  it('GET /search/suggestions?q=mug', async () => {
    const res = await api('/search/suggestions?q=mug');
    expectAlive(res, 'GET /search/suggestions');
  });
});
