import { Injectable, Logger } from '@nestjs/common';
import { PRESENCE_TTL_SECONDS, type PresenceState } from '@ezihubb/constants';
import { RedisService } from '../../common/services/redis.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Who is online, and when the rest were last here.
 *
 * Split across two stores on purpose. Live state is a Redis SET of socket ids
 * per user, because it is worthless after a restart and should die with the
 * process — a crashed API that left rows saying "online" in Postgres would
 * show every user online forever. What has to survive is the single timestamp
 * behind "last seen 5 minutes ago", and that goes in Postgres.
 *
 * The SET (rather than a counter) is what makes the count self-correcting: a
 * socket id can only be added once and removed once, so a duplicated
 * disconnect event cannot drive the count negative and strand someone as
 * permanently offline while they are still connected.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  constructor(
    private readonly redis:  RedisService,
    private readonly prisma: PrismaService,
  ) {}

  private key(userId: string): string {
    return `presence:u:${userId}`;
  }

  /**
   * Records a connected socket.
   *
   * Returns true when this is the user's FIRST socket, which is the only case
   * worth broadcasting — a second tab does not make anyone more online.
   */
  async addSocket(userId: string, socketId: string): Promise<boolean> {
    if (!this.redis.isAvailable()) return false;

    // MULTI, not three awaited calls. Redis runs a transaction without
    // interleaving, which is the only reason the size can be trusted: with
    // separate round trips, two tabs opening together both SADD and then both
    // SCARD, both read 2, and NEITHER reports the user as having come online —
    // so nobody is told they are there.
    const results = await this.redis
      .getClient()
      .multi()
      .sadd(this.key(userId), socketId)
      .scard(this.key(userId))
      .expire(this.key(userId), PRESENCE_TTL_SECONDS)
      .exec();

    const added = Number(results?.[0]?.[1] ?? 0);
    const size  = Number(results?.[1]?.[1] ?? 0);
    return added === 1 && size === 1;
  }

  /**
   * Records a socket going away.
   *
   * Returns true when the user has no sockets left, i.e. they actually went
   * offline. Only then is lastSeenAt written, so a page refresh — a disconnect
   * followed within a second by a connect — does not write on every navigation.
   */
  async removeSocket(userId: string, socketId: string): Promise<boolean> {
    if (!this.redis.isAvailable()) return false;
    const client = this.redis.getClient();

    // Same transaction reasoning as addSocket, mirrored: two tabs closing
    // together would otherwise both read 0 and both declare the user offline,
    // which writes lastSeenAt twice and broadcasts a redundant event.
    const results = await client
      .multi()
      .srem(this.key(userId), socketId)
      .scard(this.key(userId))
      .exec();
    const size = Number(results?.[1]?.[1] ?? 0);

    if (size > 0) {
      await client.expire(this.key(userId), PRESENCE_TTL_SECONDS);
      return false;
    }

    await client.del(this.key(userId));
    await this.touchLastSeen(userId);
    return true;
  }

  /**
   * Re-stamps the TTL for users this instance still holds sockets for.
   *
   * Without it the keys expire under an idle connection and a user who is
   * sitting there reading goes dark. Called on a timer by the gateway rather
   * than per packet, which would be one Redis round trip per heartbeat per
   * socket.
   */
  async refresh(userIds: Iterable<string>): Promise<void> {
    if (!this.redis.isAvailable()) return;
    const client = this.redis.getClient();
    const pipeline = client.pipeline();
    let queued = 0;
    for (const id of userIds) {
      pipeline.expire(this.key(id), PRESENCE_TTL_SECONDS);
      queued++;
    }
    if (queued > 0) await pipeline.exec();
  }

  /** True while the user has at least one live socket anywhere. */
  async isOnline(userId: string): Promise<boolean> {
    if (!this.redis.isAvailable()) return false;
    return (await this.redis.getClient().scard(this.key(userId))) > 0;
  }

  /**
   * Which of the requested users this one is allowed to see the presence of.
   *
   * Presence is not public. Without this, any account could ask about any user
   * id and be told when they are at their desk — and by asking repeatedly,
   * build a picture of when a particular seller works.
   *
   * The rule is "people you are already talking to": the buyer on a
   * conversation with your shop, or the owner of a shop you have written to.
   * Yourself is always allowed, which is what lets a client show its own state.
   *
   * Filtered BY the requested ids rather than listing every counterparty and
   * intersecting afterwards — a shop with ten thousand conversations would
   * otherwise load all of them to answer a question about five people.
   */
  async visibleTo(
    requesterId: string,
    isSuperAdmin: boolean,
    requested: string[],
  ): Promise<Set<string>> {
    const wanted = [...new Set(requested)].filter((id) => id && id !== requesterId);
    // Support staff legitimately look at any thread, so gating them here would
    // only make the tool lie about who is reachable.
    if (isSuperAdmin) return new Set([...wanted, requesterId]);
    if (wanted.length === 0) return new Set([requesterId]);

    const convos = await this.prisma.conversation.findMany({
      where: {
        OR: [
          // I am the buyer; the shop owner is who I may see.
          { userId: requesterId, store: { ownerId: { in: wanted } } },
          // I own the shop; the buyer on the thread is who I may see.
          { store: { ownerId: requesterId }, userId: { in: wanted } },
        ],
      },
      select: { userId: true, store: { select: { ownerId: true } } },
    });

    const allowed = new Set<string>([requesterId]);
    for (const c of convos) {
      if (c.userId && wanted.includes(c.userId)) allowed.add(c.userId);
      const owner = c.store?.ownerId;
      if (owner && wanted.includes(owner)) allowed.add(owner);
    }
    return allowed;
  }

  /**
   * Presence for a set of users, in one round trip each way.
   *
   * lastSeenAt is fetched only for the ones who are offline: it is meaningless
   * for someone currently connected, and skipping them keeps the query small
   * on a busy inbox.
   *
   * Takes ids the caller has ALREADY authorised through visibleTo — kept as a
   * separate step so the socket and the HTTP endpoint share one rule rather
   * than each growing their own.
   */
  async stateFor(userIds: string[]): Promise<PresenceState[]> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return [];

    let onlineFlags: boolean[] = unique.map(() => false);
    if (this.redis.isAvailable()) {
      const pipeline = this.redis.getClient().pipeline();
      for (const id of unique) pipeline.scard(this.key(id));
      const results = await pipeline.exec();
      onlineFlags = unique.map((_, i) => Number(results?.[i]?.[1] ?? 0) > 0);
    }

    const offlineIds = unique.filter((_, i) => !onlineFlags[i]);
    const seen = offlineIds.length
      ? await this.prisma.user.findMany({
          where:  { id: { in: offlineIds } },
          select: { id: true, lastSeenAt: true },
        })
      : [];
    const seenById = new Map(seen.map((u) => [u.id, u.lastSeenAt]));

    return unique.map((userId, i) => ({
      userId,
      online:     onlineFlags[i],
      lastSeenAt: onlineFlags[i] ? null : (seenById.get(userId)?.toISOString() ?? null),
    }));
  }

  /**
   * Never allowed to throw into a disconnect handler.
   *
   * A failure here costs a stale "last seen" and nothing more; letting it
   * escape would take down the socket teardown around it and leak the entry
   * in the Redis set that the same handler just cleaned up.
   */
  private async touchLastSeen(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data:  { lastSeenAt: new Date() },
      });
    } catch (e) {
      this.logger.warn(`Could not record lastSeenAt for ${userId}: ${(e as Error).message}`);
    }
  }
}
