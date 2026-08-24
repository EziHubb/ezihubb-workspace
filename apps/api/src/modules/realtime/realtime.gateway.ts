import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  PRESENCE_REFRESH_SECONDS,
  REALTIME_NAMESPACE,
  RT_CLIENT,
  RT_SERVER,
} from '@ezihubb/constants';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getAllowedOrigins,
  getConfiguredOrigins,
  isWildcardOrigin,
} from '../../common/utils/allowed-origins.util';
import { PresenceService } from './presence.service';

/** What a verified handshake leaves on the socket. */
interface SocketUser {
  userId: string;
  role:   string;
}

/**
 * The realtime edge: live messages and presence.
 *
 * Deliberately thin. It authenticates, decides who may listen to what, and
 * relays — every write still goes through the existing HTTP endpoints, so
 * moderation, notifications and push keep running exactly once, in
 * MessagesService, whichever transport the sender used. A socket handler that
 * created messages itself would be a second write path that skips all three.
 */
@WebSocketGateway({
  namespace: REALTIME_NAMESPACE,
  // Websocket only. The polling fallback needs every request of a handshake to
  // reach the same process, which means sticky sessions at nginx; skipping it
  // means a second API instance can be added without touching the proxy.
  transports: ['websocket'],
  // The same allowlist the HTTP API enforces, read from the same helper so the
  // two cannot drift. Not `origin: true`: that reflects whatever Origin the
  // caller sent, which is no restriction at all. Auth here is by bearer token
  // rather than cookie, so a reflected origin would not by itself leak a
  // session — but it would let any page open a socket and start naming
  // conversation ids at the join handler, and that is a probe worth refusing
  // at the door.
  cors: {
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      const allowed = getAllowedOrigins();
      // No Origin header means a non-browser client (a mobile app, a test);
      // those are still gated by the token check in the handshake middleware.
      cb(null, !origin || isWildcardOrigin(getConfiguredOrigins()) || allowed.has(origin));
    },
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  /** userId -> socket ids held by THIS instance, for the TTL refresh timer. */
  private readonly local = new Map<string, Set<string>>();
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly jwt:      JwtService,
    private readonly config:   ConfigService,
    private readonly prisma:   PrismaService,
    private readonly presence: PresenceService,
  ) {
    this.refreshTimer = setInterval(
      () => { void this.presence.refresh(this.local.keys()); },
      PRESENCE_REFRESH_SECONDS * 1_000,
    );
    // Node keeps the event loop alive for a pending interval; without this the
    // API would refuse to shut down cleanly.
    this.refreshTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  // ── Connection lifecycle ────────────────────────────────────────────────

  /**
   * Authentication runs as socket.io middleware, not in handleConnection.
   *
   * Nest declares handleConnection as returning void and never awaits it, so
   * an async one returns a promise nobody holds: verification is still in
   * flight while the client — which fires its own 'connect' the moment the
   * server acknowledges — is already emitting. A join arriving in that window
   * reads socket.data.user as undefined and is dropped, and the client sits in
   * a conversation it believes it joined, receiving nothing.
   *
   * Middleware closes the window by construction: socket.io queues every
   * packet until next() is called, so no handler can observe a half-set-up
   * socket. It also means an unauthenticated connection is refused at the
   * handshake instead of being established and then torn down.
   */
  afterInit(server: Server): void {
    server.use((socket, next) => {
      void this.verify(socket).then((user) => {
        if (!user) {
          next(new Error('unauthorized'));
          return;
        }
        socket.data['user'] = user;
        next();
      }).catch((e: Error) => next(e));
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    // Set by the middleware above, which cannot have let an unauthenticated
    // socket through — but read defensively so a future change that removes
    // the middleware fails closed rather than crashing on undefined.
    const user = socket.data['user'] as SocketUser | undefined;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // Their own room, so anything addressed to a person reaches every tab they
    // have open without the sender knowing about sockets.
    await socket.join(`user:${user.userId}`);

    let ids = this.local.get(user.userId);
    if (!ids) { ids = new Set(); this.local.set(user.userId, ids); }
    ids.add(socket.id);

    const cameOnline = await this.presence.addSocket(user.userId, socket.id);
    if (cameOnline) this.broadcastPresence(user.userId, true, null);
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const user = socket.data['user'] as SocketUser | undefined;
    if (!user) return;

    const ids = this.local.get(user.userId);
    if (ids) {
      ids.delete(socket.id);
      if (ids.size === 0) this.local.delete(user.userId);
    }

    const wentOffline = await this.presence.removeSocket(user.userId, socket.id);
    if (wentOffline) this.broadcastPresence(user.userId, false, new Date().toISOString());
  }

  // ── Client → server ─────────────────────────────────────────────────────

  @SubscribeMessage(RT_CLIENT.JOIN_CONVERSATION)
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId?: string },
  ): Promise<void> {
    const user = socket.data['user'] as SocketUser | undefined;
    const conversationId = body?.conversationId;
    if (!user || typeof conversationId !== 'string' || !conversationId) return;

    if (!(await this.mayRead(user, conversationId))) {
      // Told, not ignored: a client that silently never receives anything looks
      // identical to a broken socket, and this is the one case worth debugging.
      socket.emit(RT_SERVER.JOIN_DENIED, { conversationId, reason: 'forbidden' });
      this.logger.warn(`Refused ${user.userId} joining conversation ${conversationId}`);
      return;
    }

    await socket.join(this.room(conversationId));
  }

  @SubscribeMessage(RT_CLIENT.LEAVE_CONVERSATION)
  async onLeave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { conversationId?: string },
  ): Promise<void> {
    // No permission check: leaving a room you are not in is a no-op, and
    // refusing it would only strand a client that lost track of its own state.
    if (typeof body?.conversationId === 'string') {
      await socket.leave(this.room(body.conversationId));
    }
  }

  @SubscribeMessage(RT_CLIENT.PRESENCE_QUERY)
  async onPresenceQuery(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { userIds?: unknown },
  ): Promise<void> {
    const user = socket.data['user'] as SocketUser | undefined;
    if (!user) return;

    const ids = Array.isArray(body?.userIds)
      ? body.userIds.filter((x): x is string => typeof x === 'string').slice(0, 100)
      : [];
    if (ids.length === 0) return;

    // Authorised first. Presence is not public: without this an account could
    // ask about any id and learn when that person is at their desk.
    const allowed = await this.presence.visibleTo(
      user.userId,
      user.role === Role.SUPER_ADMIN,
      ids,
    );
    const visible = ids.filter((id) => allowed.has(id));
    if (visible.length === 0) return;

    // Asking is what registers interest. Updates for these users are then
    // pushed to this socket and nobody else's — the alternative, broadcasting
    // every change to the whole namespace, tells everyone about everyone and
    // costs one message per connection per change.
    await Promise.all(visible.map((id) => socket.join(this.presenceRoom(id))));

    socket.emit(RT_SERVER.PRESENCE_STATE, await this.presence.stateFor(visible));
  }

  // ── Server → client ─────────────────────────────────────────────────────

  /**
   * Called by MessagesService once the message is committed.
   *
   * Takes the already-persisted row rather than re-reading it: the caller has
   * it, and a second read could return something the sender has not seen yet.
   */
  emitMessage(conversationId: string, message: unknown): void {
    // The gateway is constructed before the server is attached in some test
    // and shutdown paths; emitting into undefined would throw inside a
    // transaction's tail.
    if (!this.server) return;
    this.server.to(this.room(conversationId)).emit(RT_SERVER.MESSAGE_NEW, {
      conversationId,
      message,
    });
  }

  /**
   * Tells only the sockets that asked about this user.
   *
   * The audience is built by onPresenceQuery, which joins a socket to
   * presence:<id> for each id it was allowed to see. That makes the fan-out
   * proportional to actual interest instead of to the number of people
   * connected, and it means presence changes are not announced to accounts
   * that have no relationship with the person they concern.
   */
  private broadcastPresence(userId: string, online: boolean, lastSeenAt: string | null): void {
    if (!this.server) return;
    this.server
      .to(this.presenceRoom(userId))
      .emit(RT_SERVER.PRESENCE_UPDATE, [{ userId, online, lastSeenAt }]);
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private room(conversationId: string): string {
    return `conv:${conversationId}`;
  }

  /** Sockets that have asked to follow one user's presence. Left implicitly on
   *  disconnect — socket.io removes a socket from every room it held. */
  private presenceRoom(userId: string): string {
    return `presence:${userId}`;
  }

  /**
   * Verifies the handshake token.
   *
   * Read from `auth.token` rather than a cookie: the admin and storefront are
   * on different origins from the API, and a cookie would not be sent on the
   * upgrade request from either.
   */
  private async verify(socket: Socket): Promise<SocketUser | null> {
    const raw =
      (socket.handshake.auth as Record<string, unknown> | undefined)?.['token'] ??
      socket.handshake.headers['authorization'];
    const token = typeof raw === 'string' ? raw.replace(/^Bearer\s+/i, '') : null;
    if (!token) return null;

    const secret = this.config.get<string>('jwt.accessSecret');
    if (!secret) {
      this.logger.error('JWT_ACCESS_SECRET not set — refusing every socket');
      return null;
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; role: string }>(token, { secret });
      if (!payload?.sub) return null;
      return { userId: payload.sub, role: payload.role };
    } catch {
      return null;
    }
  }

  /**
   * Whether this user may listen to a conversation.
   *
   * The whole point of the gateway's security: rooms are joined by name, so
   * without this anyone holding any valid token could name someone else's
   * conversation and receive every message in it.
   */
  private async mayRead(user: SocketUser, conversationId: string): Promise<boolean> {
    if (user.role === Role.SUPER_ADMIN) return true;

    const convo = await this.prisma.conversation.findUnique({
      where:  { id: conversationId },
      select: { userId: true, store: { select: { ownerId: true } } },
    });
    if (!convo) return false;

    // The buyer whose conversation it is, or the owner of the shop it is with.
    // Guest conversations have userId null and are only reachable by the shop.
    return convo.userId === user.userId || convo.store?.ownerId === user.userId;
  }
}
