import * as dotenv from 'dotenv';
import * as path from 'path';

export default function globalSetup() {
  dotenv.config({ path: path.join(__dirname, '.env.test') });
  // Must be set in the main process so Jest workers inherit it before any TLS is initialized
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
}
