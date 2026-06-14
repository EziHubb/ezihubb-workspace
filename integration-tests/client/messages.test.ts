/**
 * Integration tests — Messages & conversations (auth required)
 */
import { api, login, expectAlive } from '../helpers';

const EMAIL    = process.env['TEST_USER_EMAIL']    ?? '';
const PASSWORD = process.env['TEST_USER_PASSWORD'] ?? '';

let token = '';
beforeAll(async () => {
  if (EMAIL && PASSWORD) token = await login(EMAIL, PASSWORD);
});
const skip = () => !token;

describe('Messages', () => {
  it('GET /messages/conversations', async () => {
    if (skip()) return;
    const res = await api('/messages/conversations', { token });
    expectAlive(res, 'GET /messages/conversations');
  });
});
