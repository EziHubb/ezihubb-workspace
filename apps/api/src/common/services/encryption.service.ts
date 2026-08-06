import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM  = 'aes-256-gcm';
const IV_LENGTH  = 12;
const TAG_LENGTH = 16;

/**
 * Generic secrets-at-rest helper (AES-256-GCM) — used to store per-store
 * third-party API keys (e.g. a seller's Printify API key) so plaintext
 * credentials never sit in the database.
 *
 * Encrypted payload format: base64(iv[12] + authTag[16] + ciphertext).
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const raw = this.config.get<string>('secrets.encryptionKey', '');
    if (!raw) {
      throw new Error('SECRETS_ENCRYPTION_KEY is not configured');
    }
    this.key = Buffer.from(raw, 'base64');
    if (this.key.length !== 32) {
      throw new Error('SECRETS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of a 32-byte key)');
    }
  }

  encrypt(plaintext: string): string {
    const iv     = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    const iv         = buf.subarray(0, IV_LENGTH);
    const authTag     = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
