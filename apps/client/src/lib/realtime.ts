'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from './store/auth.store';
import { io, type Socket } from 'socket.io-client';
import {
  REALTIME_NAMESPACE,
  RT_CLIENT,
  RT_SERVER,
  type PresenceState,
} from '@ezihubb/constants';

/**
 * How long to wait before re-attempting a connection the server refused.
 *
 * A rejection from the handshake middleware is not a transport failure, and
 * socket.io does not reconnect from it — it marks the socket inactive and
 * stops. That matters because the very first attempt often loses a race with
 * auth: the access token is fetched asynchronously, so a socket opened on page
 * load can be refused for having no token and then stay dead for the life of
 * the page, with the inbox silently falling back to nothing.
 *
 * Backs off to a ceiling rather than hammering, because the other reason for a
 * refusal is a genuinely signed-out user, and that one never resolves.
 */
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS  = 30_000;

/**
 * Grace period before the last release actually closes the socket.
 *
 * React unmounts the old tree before mounting the new one, so navigating
 * between two screens that both use the socket takes the count to zero and
 * back to one — closing and re-handshaking on every navigation. React 18's
 * development double-invoke does the same thing on first mount. Waiting a
 * moment means a re-acquire inside the window simply keeps the connection.
 */
const TEARDOWN_GRACE_MS = 3_000;

/**
 * One socket for the whole tab (storefront side).
 *
 * Module-level rather than per-component: several components want the same
 * stream, and a socket each would multiply connections by however many happened
 * to mount. Reference-counted so the last one to unmount closes it — leaving it
 * open would hold a connection for every tab the seller ever visited the inbox
 * in.
 */
let socket: Socket | null = null;
let refCount = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = RETRY_BASE_MS;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

function apiOrigin(): string {
  const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002';
  // The REST base may carry /api/v1; the socket namespace hangs off the origin.
  return base.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '');
}

function acquire(): Socket {
  // Cancels a pending teardown: whoever is arriving wants the same connection
  // the departing component was about to close.
  if (teardownTimer) { clearTimeout(teardownTimer); teardownTimer = null; }

  if (!socket) {
    socket = io(`${apiOrigin()}${REALTIME_NAMESPACE}`, {
      // Matches the gateway. The polling fallback would need sticky sessions
      // at the proxy; refusing it keeps a second API instance a config change
      // rather than an infrastructure one.
      transports:   ['websocket'],
      autoConnect:  true,
      // Read fresh on every attempt, so a reconnect after the access token was
      // rotated uses the new one instead of retrying forever with the old.
      auth: (cb: (data: Record<string, unknown>) => void) => {
        cb({ token: useAuthStore.getState().accessToken ?? '' });
      },
    });

    socket.on('connect', () => {
      // A successful handshake means the token is good again; the next refusal
      // should start its own backoff rather than inherit this one's ceiling.
      retryDelay = RETRY_BASE_MS;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    });

    socket.on('connect_error', () => {
      // One timer at a time — connect_error can fire more than once per
      // attempt, and each would otherwise schedule its own reconnect.
      if (retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        // Guarded: the last component may have unmounted while this was
        // pending, in which case reconnecting would resurrect a socket nobody
        // is listening to and never close it.
        if (refCount > 0) socket?.connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    });
  }
  refCount++;
  return socket;
}

function release(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !socket || teardownTimer) return;

  teardownTimer = setTimeout(() => {
    teardownTimer = null;
    // Re-checked rather than assumed: something acquired during the grace
    // period would have cleared this timer, but a release/acquire/release in
    // the same window can leave it pending against a live connection.
    if (refCount > 0 || !socket) return;

    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    retryDelay = RETRY_BASE_MS;
    // removeAllListeners before disconnect: the handlers above close over the
    // module-level socket, and leaving them attached to an instance we are
    // about to drop is how a stale socket keeps rescheduling reconnects.
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }, TEARDOWN_GRACE_MS);
}

/** The shared socket, held for as long as the calling component is mounted. */
export function useSocket(): Socket | null {
  const [ready, setReady] = useState(false);
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    ref.current = acquire();
    setReady(true);
    return () => { ref.current = null; release(); };
  }, []);

  return ready ? ref.current : null;
}

/**
 * Live messages for one conversation.
 *
 * Re-joins on every `connect`, not just on mount: rooms live on the server, so
 * a dropped connection silently leaves them all and a socket that reconnected
 * would look healthy while delivering nothing.
 *
 * `onChanged` also fires on every (re)connect, not only on a pushed message.
 * Rejoining a room does not replay what was said while the socket was away —
 * anything sent during the gap was delivered to a room this socket had already
 * left, and is simply gone. Without a fetch on reconnect the thread stays
 * silently stale until something else happens to refresh it, which on the
 * seller's inbox is nothing at all: it has no polling. The storefront does
 * poll, but only once a minute.
 *
 * Firing on the first connect too is deliberate and harmless — the query it
 * triggers has usually just run, and paying one redundant fetch is cheaper
 * than the branching needed to tell a first connect from a reconnect.
 */
export function useConversationStream(
  conversationId: string | null,
  onChanged: () => void,
): void {
  const sock = useSocket();
  // Through a ref so a caller passing an inline arrow does not tear down and
  // rebuild the subscription on every render.
  const handler = useRef(onChanged);
  handler.current = onChanged;

  useEffect(() => {
    if (!sock || !conversationId) return;

    const join = () => {
      sock.emit(RT_CLIENT.JOIN_CONVERSATION, { conversationId });
      handler.current();
    };
    const onNew = (payload: { conversationId: string }) => {
      if (payload?.conversationId === conversationId) handler.current();
    };

    if (sock.connected) join();
    sock.on('connect', join);
    sock.on(RT_SERVER.MESSAGE_NEW, onNew);

    return () => {
      sock.off('connect', join);
      sock.off(RT_SERVER.MESSAGE_NEW, onNew);
      if (sock.connected) sock.emit(RT_CLIENT.LEAVE_CONVERSATION, { conversationId });
    };
  }, [sock, conversationId]);
}

/**
 * Online state for a set of users.
 *
 * The query is what subscribes: the server answers with the current state AND
 * registers this socket for future changes to those users. So asking again on
 * every reconnect is not a refresh, it is a re-subscription — rooms live on
 * the server and are lost with the connection.
 *
 * Only people you share a conversation with are answered for; the server
 * filters the rest out rather than refusing the whole request.
 */
export function usePresence(userIds: string[]): Map<string, PresenceState> {
  const sock = useSocket();
  const [state, setState] = useState<Map<string, PresenceState>>(new Map());
  // Sorted and joined so a caller rebuilding the array each render does not
  // re-run this effect forever.
  const key = [...new Set(userIds.filter(Boolean))].sort().join(',');

  useEffect(() => {
    if (!sock || !key) return;
    const ids = key.split(',');

    const apply = (rows: PresenceState[]) =>
      setState((prev) => {
        const next = new Map(prev);
        for (const r of rows) next.set(r.userId, r);
        return next;
      });

    const ask = () => sock.emit(RT_CLIENT.PRESENCE_QUERY, { userIds: ids });
    if (sock.connected) ask();
    sock.on('connect', ask);
    sock.on(RT_SERVER.PRESENCE_STATE,  apply);
    sock.on(RT_SERVER.PRESENCE_UPDATE, apply);

    return () => {
      sock.off('connect', ask);
      sock.off(RT_SERVER.PRESENCE_STATE,  apply);
      sock.off(RT_SERVER.PRESENCE_UPDATE, apply);
    };
  }, [sock, key]);

  return state;
}

/** "Online" / "Last seen 5 minutes ago" — one place so both apps read alike. */
export function presenceLabel(p: PresenceState | undefined): string {
  if (!p) return '';
  if (p.online) return 'Online';
  if (!p.lastSeenAt) return 'Offline';

  const diffMs = Date.now() - new Date(p.lastSeenAt).getTime();
  const mins   = Math.floor(diffMs / 60_000);
  // Clock skew between the browser and the server can make a fresh timestamp
  // look like the future; "in 3 minutes" is worse than rounding to just now.
  if (mins < 1)  return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Last seen ${hours}h ago`;

  const days = Math.floor(hours / 24);
  return days < 7
    ? `Last seen ${days}d ago`
    : `Last seen ${new Date(p.lastSeenAt).toLocaleDateString()}`;
}
