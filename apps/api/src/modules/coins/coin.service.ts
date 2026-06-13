import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CoinTxType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';

const COINS_PER_DOLLAR        = 10;
const COINS_PER_DOLLAR_REDEEM = 100;
const COIN_TTL_DAYS           = 365;
const BALANCE_CACHE_TTL       = 300;

function coinsCacheKey(userId: string): string { return `coins:${userId}`; }
function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

@Injectable()
export class CoinService {
  private readonly logger = new Logger(CoinService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  async earnCoins(userId: string, orderId: string, amount: number): Promise<void> {
    const coinsToEarn = Math.floor(amount * COINS_PER_DOLLAR);
    if (coinsToEarn <= 0) return;
    const expiresAt = addDays(COIN_TTL_DAYS);

    await this.prisma.$transaction(async (tx) => {
      await tx.buyerCoinBalance.upsert({
        where:  { userId },
        create: { userId, availableCoins: coinsToEarn, pendingCoins: 0, lifetimeEarned: coinsToEarn, lifetimeRedeemed: 0 },
        update: { availableCoins: { increment: coinsToEarn }, lifetimeEarned: { increment: coinsToEarn } },
      });
      await tx.coinTransaction.create({
        data: { userId, type: CoinTxType.PURCHASE, amount: coinsToEarn, referenceId: orderId, referenceType: 'order', expiresAt },
      });
    });

    await this.redis.del(coinsCacheKey(userId));
    this.logger.log(`Coins earned: user=${userId} order=${orderId} coins=${coinsToEarn}`);
  }

  async earnReviewCoins(userId: string, reviewId: string, hasPhoto: boolean): Promise<void> {
    const coinsToEarn = hasPhoto ? 100 : 50;
    const txType      = hasPhoto ? CoinTxType.REVIEW_PHOTO : CoinTxType.REVIEW_TEXT;
    const expiresAt   = addDays(COIN_TTL_DAYS);

    await this.prisma.$transaction(async (tx) => {
      await tx.buyerCoinBalance.upsert({
        where:  { userId },
        create: { userId, availableCoins: coinsToEarn, pendingCoins: 0, lifetimeEarned: coinsToEarn, lifetimeRedeemed: 0 },
        update: { availableCoins: { increment: coinsToEarn }, lifetimeEarned: { increment: coinsToEarn } },
      });
      await tx.coinTransaction.create({
        data: { userId, type: txType, amount: coinsToEarn, referenceId: reviewId, referenceType: 'review', expiresAt },
      });
    });

    await this.redis.del(coinsCacheKey(userId));
    this.logger.log(`Review coins: user=${userId} review=${reviewId} coins=${coinsToEarn}`);
  }

  async redeemCoins(userId: string, coinsToRedeem: number): Promise<{ discountAmt: number }> {
    const coinBalance    = await this.prisma.buyerCoinBalance.findUnique({ where: { userId } });
    const currentBalance = coinBalance?.availableCoins ?? 0;

    if (currentBalance < coinsToRedeem) {
      throw new BadRequestException({ code: 'ERR_INSUFFICIENT_COINS', message: `Have ${currentBalance}, need ${coinsToRedeem}.` });
    }

    const discountAmt = coinsToRedeem / COINS_PER_DOLLAR_REDEEM;

    await this.prisma.$transaction(async (tx) => {
      await tx.buyerCoinBalance.update({
        where: { userId },
        data:  { availableCoins: { decrement: coinsToRedeem }, lifetimeRedeemed: { increment: coinsToRedeem } },
      });
      await tx.coinTransaction.create({
        data: { userId, type: CoinTxType.REDEEM, amount: -coinsToRedeem },
      });
    });

    await this.redis.del(coinsCacheKey(userId));
    return { discountAmt };
  }

  async deductForRefund(userId: string, orderId: string, coinsEarned: number): Promise<void> {
    if (coinsEarned <= 0) return;

    await this.prisma.$transaction(async (tx) => {
      const existing       = await tx.buyerCoinBalance.findUnique({ where: { userId } });
      const currentBalance = existing?.availableCoins ?? 0;
      const deduction      = Math.min(coinsEarned, currentBalance);
      if (deduction <= 0) return;

      await tx.buyerCoinBalance.update({ where: { userId }, data: { availableCoins: { decrement: deduction } } });
      await tx.coinTransaction.create({
        data: { userId, type: CoinTxType.REFUND_DEDUCTION, amount: -deduction, referenceId: orderId, referenceType: 'order', note: `Refund for order ${orderId}` },
      });
    });

    await this.redis.del(coinsCacheKey(userId));
  }

  async getBalance(userId: string): Promise<{ balance: number; lifetimeEarned: number; expiringIn30Days: number }> {
    const cached = await this.redis.get<{ balance: number; lifetimeEarned: number; expiringIn30Days: number }>(coinsCacheKey(userId));
    if (cached) return cached;

    const coinBalance    = await this.prisma.buyerCoinBalance.findUnique({ where: { userId } });
    const balance        = coinBalance?.availableCoins  ?? 0;
    const lifetimeEarned = coinBalance?.lifetimeEarned  ?? 0;

    const cutoff      = addDays(30);
    const expiringAgg = await this.prisma.coinTransaction.aggregate({
      where: { userId, expiresAt: { lt: cutoff }, amount: { gt: 0 }, isExpired: false },
      _sum: { amount: true },
    });
    const expiringIn30Days = expiringAgg._sum.amount ?? 0;

    const result = { balance, lifetimeEarned, expiringIn30Days };
    await this.redis.set(coinsCacheKey(userId), result, BALANCE_CACHE_TTL);
    return result;
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.coinTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.coinTransaction.count({ where: { userId } }),
    ]);
    return { data, total };
  }

  async expireCoins(): Promise<void> {
    const now        = new Date();
    const expiredTxs = await this.prisma.coinTransaction.findMany({
      where: { expiresAt: { lt: now }, amount: { gt: 0 }, isExpired: false, type: { not: CoinTxType.EXPIRY } },
      select: { id: true, userId: true, amount: true },
    });
    if (expiredTxs.length === 0) return;

    const grouped = new Map<string, number>();
    for (const tx of expiredTxs) grouped.set(tx.userId, (grouped.get(tx.userId) ?? 0) + tx.amount);

    for (const [userId, totalExpired] of grouped.entries()) {
      await this.prisma.$transaction(async (tx) => {
        const cb = await tx.buyerCoinBalance.findUnique({ where: { userId } });
        if (!cb) return;
        const deduction = Math.min(totalExpired, cb.availableCoins);
        if (deduction <= 0) return;
        await tx.buyerCoinBalance.update({ where: { userId }, data: { availableCoins: { decrement: deduction } } });
        await tx.coinTransaction.create({ data: { userId, type: CoinTxType.EXPIRY, amount: -deduction, note: 'Coins expired' } });
      });
      await this.redis.del(coinsCacheKey(userId));
    }
    // Mark processed transactions as expired
    await this.prisma.coinTransaction.updateMany({
      where: { expiresAt: { lt: now }, amount: { gt: 0 }, isExpired: false },
      data: { isExpired: true },
    });
    this.logger.log(`Coin expiry: processed ${grouped.size} users`);
  }
}
