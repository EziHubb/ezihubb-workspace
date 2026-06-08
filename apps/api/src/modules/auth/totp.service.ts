import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateSecret, generateURI, verify } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALG = 'aes-256-cbc';
const IV_LENGTH = 16;

@Injectable()
export class TotpService {
  private readonly logger = new Logger(TotpService.name);
  private readonly encryptionKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('TOTP_ENCRYPTION_KEY') ?? '';
    if (!raw || raw.length < 64) {
      this.logger.warn('TOTP_ENCRYPTION_KEY is missing or too short — must be 64 hex characters (32 bytes). Using insecure fallback in production is a security risk.');
    }
    const keyHex = raw.padEnd(64, '0').slice(0, 64);
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  // ─── Secret & URI ─────────────────────────────────────────────────────────

  newSecret(): string {
    return generateSecret({ length: 20 });
  }

  otpAuthUri(secret: string, email: string): string {
    return generateURI({ issuer: 'MapleLoom Admin', label: email, secret });
  }

  async qrCodeDataUrl(otpauthUri: string): Promise<string> {
    return QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: 'M', width: 256 });
  }

  // ─── Verification ──────────────────────────────────────────────────────────

  async verifyToken(secret: string, token: string): Promise<boolean> {
    try {
      const result = await verify({ secret, token });
      return result.valid;
    } catch {
      return false;
    }
  }

  // ─── Backup codes ──────────────────────────────────────────────────────────

  generateBackupCodes(): string[] {
    return Array.from({ length: 8 }, () => randomBytes(4).toString('hex').toUpperCase());
  }

  /** Returns remaining codes after consuming the matched one, or null if no match. */
  async consumeBackupCode(storedHashes: string[], input: string): Promise<string[] | null> {
    const normalised = input.toUpperCase().replace(/\s/g, '');
    for (let i = 0; i < storedHashes.length; i++) {
      if (await bcrypt.compare(normalised, storedHashes[i])) {
        const remaining = [...storedHashes];
        remaining.splice(i, 1);
        return remaining;
      }
    }
    return null;
  }

  async hashBackupCodes(plainCodes: string[]): Promise<string[]> {
    return Promise.all(plainCodes.map((c) => bcrypt.hash(c.toUpperCase(), 10)));
  }

  // ─── Encryption ────────────────────────────────────────────────────────────

  encryptSecret(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALG, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decryptSecret(stored: string): string {
    const colonIdx = stored.indexOf(':');
    if (colonIdx === -1) throw new Error('Malformed encrypted TOTP secret — missing IV separator');
    const ivHex  = stored.slice(0, colonIdx);
    const encHex = stored.slice(colonIdx + 1);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv(ALG, this.encryptionKey, iv);
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  }
}
