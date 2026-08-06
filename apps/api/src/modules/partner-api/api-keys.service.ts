import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const KEY_PREFIX_LENGTH = 12;

const LIST_SELECT = {
  id:         true,
  name:       true,
  keyPrefix:  true,
  lastUsedAt: true,
  revokedAt:  true,
  createdAt:  true,
  // keyHash intentionally excluded — never returned
} as const;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async listForStore(storeId: string) {
    return this.prisma.apiKey.findMany({
      where:  { storeId },
      select: LIST_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Returns the full plaintext key ONCE — never retrievable again after this call. */
  async create(storeId: string, name: string) {
    const rawKey  = `ezhb_${randomBytes(24).toString('base64url')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const created = await this.prisma.apiKey.create({
      data: {
        storeId,
        name,
        keyPrefix: rawKey.slice(0, KEY_PREFIX_LENGTH),
        keyHash,
      },
      select: LIST_SELECT,
    });

    return { ...created, key: rawKey };
  }

  async revoke(storeId: string, id: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({ where: { id, storeId } });
    if (!key) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.update({
      where: { id },
      data:  { revokedAt: new Date() },
    });
  }
}
