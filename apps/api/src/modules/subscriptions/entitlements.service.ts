import { Injectable } from '@nestjs/common';
import type { PlusFeature } from '@ezihubb/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { isEntitled } from './subscription-status.util';

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Phase 1: every `PlusFeature` maps to the exact same check — does the
   * store have an active, unexpired StoreSubscription. `feature` does NOT
   * branch anything yet; it stays in the signature so a future multi-tier
   * setup doesn't require touching every call site. Don't assume it
   * differentiates today.
   */
  async canUseFeature(storeId: string, _feature: PlusFeature): Promise<boolean> {
    const sub = await this.prisma.storeSubscription.findUnique({
      where: { storeId },
      select: { status: true, currentPeriodEnd: true },
    });
    return isEntitled(sub);
  }
}
