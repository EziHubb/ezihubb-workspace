'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from './store/auth.store';
import { io, type Socket } from 'socket.io-client';
import {
  REALTIME_NAMESPACE,
  RT_CLIENT,
  RT_SERVER,
  TYPING_EXPIRY_MS,
  TYPING_HEARTBEAT_MS,
  TYPING_IDLE_MS,
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

/**
 * Which conversation is on screen right now, if any.
 *
 * Module-level because the two components that need it are nowhere near each
 * other in the tree: the thread sets it, and the sidebar — mounted on every
 * page — reads it to decide whether a toast is worth showing. Announcing a
 * message the reader is already looking at is how people learn to ignore
 * toasts entirely.
 *
 * Set by useConversationStream rather than by each caller, so there is nothing
 * extra to remember and it cannot drift from what is actually rendered.
 */
let openConversationId: string | null = null;

/** True while this conversation is the one on screen. */
export function isConversationOpen(conversationId: string): boolean {
  return openConversationId !== null && openConversationId === conversationId;
}

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
 * seller's inbox is nothing at all: it has no polling.
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

  // Registered separately from the socket effect: it has to hold even before
  // the socket connects, and it has to be released on unmount whether the
  // socket ever came up or not.
  useEffect(() => {
    if (!conversationId) return;
    openConversationId = conversationId;
    return () => {
      // Guarded: a fast switch between threads can run this cleanup after the
      // next one has already claimed the slot.
      if (openConversationId === conversationId) openConversationId = null;
    };
  }, [conversationId]);

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
    // Read receipts and unsends change what the thread should show just as
    // much as a new message does, and the caller's response is the same:
    // refetch. Routing them through one callback keeps the caller from having
    // to know which kind of change it was.
    sock.on(RT_SERVER.MESSAGES_READ, onNew);
    sock.on(RT_SERVER.MESSAGE_DELETED, onNew);

    return () => {
      sock.off('connect', join);
      sock.off(RT_SERVER.MESSAGE_NEW, onNew);
      sock.off(RT_SERVER.MESSAGES_READ, onNew);
      sock.off(RT_SERVER.MESSAGE_DELETED, onNew);
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

/**
 * Anything arriving for this person, on any page.
 *
 * Listens on the per-user room the gateway joins at connect, not on a
 * conversation room — the caller is typically the sidebar, which is mounted
 * everywhere and has joined no thread. Without this its badge only moved on
 * the two-minute poll, so a seller watching the screen saw nothing happen
 * when a customer wrote to them.
 */
export function useInboxNotifications(
  onIncoming: (payload: { conversationId: string; from: string; preview: string; avatarUrl?: string | null }) => void,
): void {
  const sock = useSocket();
  const handler = useRef(onIncoming);
  handler.current = onIncoming;

  useEffect(() => {
    if (!sock) return;
    const onEvent = (payload: { conversationId: string; from: string; preview: string; avatarUrl?: string | null }) => {
      if (payload?.conversationId) handler.current(payload);
    };
    sock.on(RT_SERVER.INBOX_CHANGED, onEvent);
    return () => { sock.off(RT_SERVER.INBOX_CHANGED, onEvent); };
  }, [sock]);
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

/**
 * The "…is typing" channel for one open thread, both directions.
 *
 * Returns what to render and the two calls the composer makes. The caller
 * never touches the socket or the timing rules, so the client and the shop
 * cannot drift into announcing themselves differently.
 *
 * Authorisation is not re-checked here: the server accepts a typing packet
 * only from a socket already in the conversation room, and that room was
 * joined through the permission check in useConversationMessages. A thread
 * this user may not read is one whose room they are not in, so their typing
 * goes nowhere.
 */
export function useTyping(conversationId: string | null): {
  someoneTyping: boolean;
  notifyTyping:  () => void;
  notifyStopped: () => void;
} {
  const sock = useSocket();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // ── Receiving ───────────────────────────────────────────────────────────
  // One expiry timer per person. The server never sends a "still typing" that
  // this does not restart, so a sender who vanishes mid-word — closed tab,
  // dropped connection, closed lid — stops the indicator by simply going
  // quiet. Nothing else covers that case: every explicit stop needs the
  // sender to still be there to send it.
  const expiries = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!sock || !conversationId) return;

    // Captured once instead of reaching through the ref on each use. The Map
    // is created with the ref and never replaced, so the two are the same
    // object — but the cleanup below reads it after the component may have
    // moved on, and a local makes it plain which Map is being cleared.
    const timers = expiries.current;

    const forget = (userId: string) => {
      const timer = timers.get(userId);
      if (timer) clearTimeout(timer);
      timers.delete(userId);
      setTypingUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : prev));
    };

    const onUpdate = (payload: { conversationId?: string; userId?: string; typing?: boolean }) => {
      if (payload?.conversationId !== conversationId) return;
      const userId = payload?.userId;
      if (typeof userId !== 'string') return;

      if (!payload.typing) { forget(userId); return; }

      const running = timers.get(userId);
      if (running) clearTimeout(running);
      timers.set(userId, setTimeout(() => forget(userId), TYPING_EXPIRY_MS));
      setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    };

    sock.on(RT_SERVER.TYPING_UPDATE, onUpdate);
    return () => {
      sock.off(RT_SERVER.TYPING_UPDATE, onUpdate);
      // Switching threads must not carry the old thread's indicator across.
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      setTypingUsers([]);
    };
  }, [sock, conversationId]);

  // ── Sending ─────────────────────────────────────────────────────────────
  const lastSentAt = useRef(0);
  const announced  = useRef(false);
  const idleTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const emitTyping = useCallback(
    (typing: boolean) => {
      if (!sock || !conversationId) return;
      sock.emit(RT_CLIENT.TYPING, { conversationId, typing });
    },
    [sock, conversationId],
  );

  const notifyStopped = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = undefined;
    if (!announced.current) return;
    announced.current = false;
    lastSentAt.current = 0;
    emitTyping(false);
  }, [emitTyping]);

  /**
   * Called on every keystroke, but emits at most once per heartbeat — a packet
   * per character would say nothing the first one did not.
   */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!announced.current || now - lastSentAt.current >= TYPING_HEARTBEAT_MS) {
      announced.current  = true;
      lastSentAt.current = now;
      emitTyping(true);
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(notifyStopped, TYPING_IDLE_MS);
  }, [emitTyping, notifyStopped]);

  // Leaving the thread while mid-word is the common case, not an edge one:
  // people navigate away from a half-written message all the time. `emitTyping`
  // is rebuilt when conversationId changes, so this cleanup still holds the
  // previous thread's id and stops typing in the thread actually left.
  useEffect(() => {
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (announced.current) {
        announced.current = false;
        emitTyping(false);
      }
    };
  }, [emitTyping]);

  return { someoneTyping: typingUsers.length > 0, notifyTyping, notifyStopped };
}
