import { Injectable } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ALL_PLATFORMS: SocialPlatform[] = ['FACEBOOK', 'PINTEREST', 'X'];

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  async getConnections(storeId: string) {
    const rows = await this.prisma.storeSocialConnection.findMany({ where: { storeId } });
    const byPlatform = new Map(rows.map((r) => [r.platform, r]));
    return ALL_PLATFORMS.map((platform) => {
      const row = byPlatform.get(platform);
      return {
        platform,
        status:      row?.status ?? 'DISCONNECTED',
        connectedAt: row?.connectedAt ?? null,
      };
    });
  }

  /** UI-only toggle — no real OAuth handshake, per explicit scope decision. */
  async setConnection(storeId: string, platform: SocialPlatform, connect: boolean) {
    const connection = await this.prisma.storeSocialConnection.upsert({
      where:  { storeId_platform: { storeId, platform } },
      create: { storeId, platform, status: connect ? 'CONNECTED' : 'DISCONNECTED', connectedAt: connect ? new Date() : null },
      update: { status: connect ? 'CONNECTED' : 'DISCONNECTED', connectedAt: connect ? new Date() : null },
    });
    return connection;
  }

  /** Real data to seed the "Create post" wizard — newest listings + active sales/promos. */
  async getShareableContent(storeId: string) {
    const now = new Date();
    const [newestListings, activeSales] = await Promise.all([
      this.prisma.product.findMany({
        where: { storeId, isActive: true, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true, name: true, slug: true, basePrice: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        },
      }),
      this.prisma.promotion.findMany({
        where: {
          storeId, isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, description: true, type: true, value: true, autoApply: true, code: true },
      }),
    ]);

    return {
      newestListings: newestListings.map((p) => ({
        id: p.id, name: p.name, slug: p.slug, price: Number(p.basePrice),
        imageUrl: p.images[0]?.url ?? null,
      })),
      activeSales: activeSales.map((s) => ({
        id: s.id,
        label: s.description ?? (s.autoApply ? 'Shop sale' : `Code ${s.code}`),
        type: s.type,
        value: Number(s.value),
      })),
    };
  }

  async createPost(storeId: string, content: string, imageUrl: string | undefined, platforms: SocialPlatform[]) {
    return this.prisma.socialPost.create({
      data: { storeId, content, imageUrl, platforms },
    });
  }

  async listPosts(storeId: string) {
    return this.prisma.socialPost.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' }, take: 20 });
  }
}
