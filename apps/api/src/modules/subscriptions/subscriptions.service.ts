import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { addMonths, addYears } from 'date-fns';
import type { StoreSubscription, StoreSubscriptionCycle } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isEntitled } from './subscription-status.util';

const PLATFORM_SETTINGS_ID = 'singleton';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getForStore(storeId: string): Promise<StoreSubscription | null> {
    return this.prisma.storeSubscription.findUnique({ where: { storeId } });
  }

  /**
   * First-time grant, or re-activating a store whose Plus already lapsed
   * (expired or was revoked). Rejects if the store already has an active,
   * unexpired subscription — callers must use `extend()` for that instead,
   * so "grant" and "add more time to an existing one" never get conflated.
   * A double-click that fires this twice: the 2nd call sees the 1st's
   * now-active row and hits the ERR_ALREADY_HAS_PLUS guard, not a silent
   * overwrite or a stacked duplicate.
   */
  async grant(
    storeId: string,
    cycle: StoreSubscriptionCycle,
    grantedByUserId: string,
  ): Promise<StoreSubscription> {
    const existing = await this.prisma.storeSubscription.findUnique({ where: { storeId } });
    if (existing && isEntitled(existing)) {
      throw new ConflictException({
        code: 'ERR_ALREADY_HAS_PLUS',
        message: 'This store already has an active Plus subscription — use "extend" to add more time instead.',
      });
    }

    // Upsert-on-read, identical to StoresService.getPlatformSettings() — the
    // singleton row is created on demand from the schema's own defaults
    // (plusMonthlyPrice 5.00, plusAnnualPrice null) if it doesn't exist yet.
    // findUniqueOrThrow here would 500 on a DB where the seed never ran and
    // nobody had opened the platform-settings page; no new default values are
    // invented here, `create` carries only the id exactly like that method.
    const settings = await this.prisma.platformSettings.upsert({
      where:  { id: PLATFORM_SETTINGS_ID },
      update: {},
      create: { id: PLATFORM_SETTINGS_ID },
    });
    const priceAtPurchase = cycle === 'ANNUAL' ? settings.plusAnnualPrice : settings.plusMonthlyPrice;
    if (priceAtPurchase == null) {
      throw new BadRequestException({
        code: 'ERR_ANNUAL_PRICE_NOT_SET',
        message: 'Annual Plus pricing has not been configured yet — grant a MONTHLY subscription instead.',
      });
    }

    const now = new Date();
    const currentPeriodEnd = cycle === 'ANNUAL' ? addYears(now, 1) : addMonths(now, 1);

    return this.prisma.storeSubscription.upsert({
      where: { storeId },
      create: {
        storeId, status: 'ACTIVE', cycle, priceAtPurchase,
        currentPeriodStart: now, currentPeriodEnd, grantedByUserId,
      },
      update: {
        status: 'ACTIVE', cycle, priceAtPurchase,
        currentPeriodStart: now, currentPeriodEnd,
        cancelAtPeriodEnd: false, cancelledAt: null, grantedByUserId,
      },
    });
  }

  /**
   * Adds `months` on top of the store's current entitlement. Stacks from
   * the existing `currentPeriodEnd` if still entitled (never shortens
   * remaining time), or from now if it already lapsed.
   */
  async extend(storeId: string, months: number, grantedByUserId: string): Promise<StoreSubscription> {
    const existing = await this.requireSubscription(storeId);
    const base = isEntitled(existing) ? existing.currentPeriodEnd : new Date();
    return this.prisma.storeSubscription.update({
      where: { storeId },
      data: { currentPeriodEnd: addMonths(base, months), status: 'ACTIVE', grantedByUserId },
    });
  }

  /**
   * Seller-intent "don't renew me" — status stays ACTIVE, access continues
   * until currentPeriodEnd (matches the "use until period end" cancellation
   * policy). NOT exposed via a seller-facing endpoint in Phase 1 (nothing
   * auto-renews yet under manual grants, so there is nothing for a seller
   * to meaningfully "stop" — see design notes). Kept as an internal method
   * SUPER_ADMIN can invoke on a seller's behalf, and ready to become the
   * real self-service cancel once a payment gateway lands.
   */
  async cancelRenewal(storeId: string, _actorUserId: string): Promise<StoreSubscription> {
    // _actorUserId: not yet persisted on the row itself — the caller logs it to AuditLog
    await this.requireSubscription(storeId);
    return this.prisma.storeSubscription.update({
      where: { storeId },
      data: { cancelAtPeriodEnd: true, cancelledAt: new Date() },
    });
  }

  /** SUPER_ADMIN-only immediate cutoff — fraud, refund, mistake. No grace period. */
  async revokeImmediately(storeId: string): Promise<StoreSubscription> {
    await this.requireSubscription(storeId);
    return this.prisma.storeSubscription.update({
      where: { storeId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
  }

  /** Never leak a raw Prisma "record not found" error to the client. */
  private async requireSubscription(storeId: string): Promise<StoreSubscription> {
    const sub = await this.prisma.storeSubscription.findUnique({ where: { storeId } });
    if (!sub) {
      throw new NotFoundException({
        code: 'ERR_NO_SUBSCRIPTION',
        message: 'This store has never had a Plus subscription.',
      });
    }
    return sub;
  }
}
