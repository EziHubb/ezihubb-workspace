import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

/** Header a SUPER_ADMIN sends to act on the one store they personally own, instead of platform-wide. Ignored for plain ADMIN callers — they can't escape their own store's scope. */
export const STORE_CONTEXT_HEADER = 'x-store-context';

interface JwtLike { sub?: string; id?: string; role?: string; storeId?: string }

export interface StoreContext {
  /** The store to scope queries to, or null when acting platform-wide. */
  storeId: string | null;
  /** True only for a SUPER_ADMIN NOT currently switched into their own store. */
  isPlatformContext: boolean;
}

/**
 * Single source of truth for "which store is this admin request scoped to",
 * replacing the ~10 near-duplicate `resolveSellerStoreId` copies that used to
 * exist per-module (fulfillment, orders, reviews, messages, promotions,
 * shipping, products, shop-sections, shop-stats, partner-api) — those had
 * drifted into 3 different behaviors for a SUPER_ADMIN who also owns a store.
 *
 * Rule: ADMIN (shop owner) is always scoped to their own storeId. SUPER_ADMIN
 * defaults to platform-wide (isPlatformContext=true, storeId=null) unless the
 * X-Store-Context header names the one store they personally own, in which
 * case they're scoped exactly like a regular shop owner for that request.
 */
@Injectable()
export class StoreContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(req: Request): Promise<StoreContext> {
    const user = req.user as JwtLike | undefined;
    if (!user) throw new ForbiddenException('Not authenticated');

    const ownStoreId = await this.ownedStoreId(user);

    if (user.role === 'SUPER_ADMIN') {
      const header = req.headers[STORE_CONTEXT_HEADER];
      const requestedStoreId = Array.isArray(header) ? header[0] : header;
      if (!requestedStoreId) {
        return { storeId: null, isPlatformContext: true };
      }
      if (!ownStoreId || requestedStoreId !== ownStoreId) {
        throw new ForbiddenException('You can only switch into a store you own');
      }
      return { storeId: ownStoreId, isPlatformContext: false };
    }

    if (!ownStoreId) {
      throw new ForbiddenException('Your account is not linked to a store');
    }
    return { storeId: ownStoreId, isPlatformContext: false };
  }

  /** For endpoints that only make sense with an active store selected (e.g. fulfillment connections). */
  requireStoreId(context: StoreContext): string {
    if (!context.storeId) {
      throw new BadRequestException('This action requires an active store — select or switch into a store first');
    }
    return context.storeId;
  }

  /**
   * For endpoints that must always act on exactly one store, but where a
   * platform-context SUPER_ADMIN is allowed to manage ANY store (not just
   * one they own) by naming it explicitly — e.g. fulfillment connections or
   * partner API keys, managed platform-wide from Settings. A scoped caller
   * (plain ADMIN, or a SUPER_ADMIN switched into "My Store") always acts on
   * their own store regardless of what `requestedStoreId` says, so this can
   * never be used to reach another store's data via IDOR.
   */
  resolveTargetStoreId(context: StoreContext, requestedStoreId?: string): string {
    if (!context.isPlatformContext) return this.requireStoreId(context);
    if (!requestedStoreId) {
      throw new BadRequestException('storeId is required when managing platform-wide settings');
    }
    return requestedStoreId;
  }

  /** For endpoints that only make sense platform-wide (e.g. cross-store rankings, moderation queues). */
  requirePlatformContext(context: StoreContext): void {
    if (!context.isPlatformContext) {
      throw new ForbiddenException('This is a platform-wide view — switch out of your store first');
    }
  }

  /**
   * Throws unless the record's own storeId matches the caller's context.
   * A SUPER_ADMIN in platform context always passes (they can act across
   * every store); everyone else must match exactly.
   */
  assertOwnership(context: StoreContext, recordStoreId: string | null | undefined): void {
    if (context.isPlatformContext) return;
    if (!recordStoreId || recordStoreId !== context.storeId) {
      throw new ForbiddenException('You do not have access to this resource');
    }
  }

  private async ownedStoreId(user: JwtLike): Promise<string | null> {
    if (user.storeId) return user.storeId;
    const userId = user.sub ?? user.id;
    if (!userId) return null;
    const dbUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { storeId: true } });
    return dbUser?.storeId ?? null;
  }
}
