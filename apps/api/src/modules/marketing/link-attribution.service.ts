import { Injectable } from '@nestjs/common';
import { LinkClickKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LINK_ATTRIBUTION_WINDOW_DAYS } from './marketing.constants';

export interface TrackClickInput {
  storeId:    string;
  kind:       LinkClickKind;
  visitorId:  string;
  productId?: string;
  source?:    string;
  /** SHARE_SAVE only — the buyer who generated the personalized link. Ignored for OFFSITE_AD. */
  sharerId?:  string;
}

@Injectable()
export class LinkAttributionService {
  constructor(private readonly prisma: PrismaService) {}

  async trackClick(input: TrackClickInput): Promise<void> {
    await this.prisma.storeLinkClick.create({
      data: {
        storeId:   input.storeId,
        kind:      input.kind,
        visitorId: input.visitorId,
        productId: input.productId ?? null,
        source:    input.source ?? null,
        sharerId:  input.kind === 'SHARE_SAVE' ? (input.sharerId ?? null) : null,
      },
    });
  }

  /**
   * The single most recent click (either kind) for this visitor+store within
   * the attribution window — "last click wins" is enforced simply by sorting
   * across both kinds together rather than checking them independently,
   * which is what makes Share & Save and Offsite Ads mutually exclusive.
   */
  async resolveAttribution(visitorId: string, storeId: string) {
    const cutoff = new Date(Date.now() - LINK_ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    return this.prisma.storeLinkClick.findFirst({
      where: { visitorId, storeId, createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markConverted(clickId: string, orderId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.storeLinkClick.update({ where: { id: clickId }, data: { convertedAt: new Date(), orderId } });
  }
}
