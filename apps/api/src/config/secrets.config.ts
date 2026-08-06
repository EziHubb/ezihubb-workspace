import { registerAs } from '@nestjs/config';

export default registerAs('secrets', () => ({
  encryptionKey: process.env.SECRETS_ENCRYPTION_KEY ?? '',
}));
