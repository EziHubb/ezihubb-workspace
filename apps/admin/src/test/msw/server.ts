import { setupServer } from 'msw/node';
import { storeHandlers, moderationHandlers } from './handlers';

export const server = setupServer(...storeHandlers, ...moderationHandlers);
