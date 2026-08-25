/**
 * The socket contract, shared by the API and both front-ends.
 *
 * Event names live here rather than as string literals on each side because a
 * typo in one of them fails silently: the emitter emits happily, the listener
 * never fires, and nothing logs. One definition makes that a compile error.
 */

/** Namespace the gateway is mounted on. Kept off '/' so a stray connection to
 *  the default namespace cannot receive anything. */
export const REALTIME_NAMESPACE = '/rt';

/** Client → server. */
export const RT_CLIENT = {
  /** Start receiving messages for one conversation. Payload: { conversationId } */
  JOIN_CONVERSATION:  'conversation:join',
  /** Stop receiving them. Payload: { conversationId } */
  LEAVE_CONVERSATION: 'conversation:leave',
  /** Ask whether some users are online. Payload: { userIds: string[] } */
  PRESENCE_QUERY:     'presence:query',
} as const;

/** Server → client. */
export const RT_SERVER = {
  /** A message was created in a conversation this socket has joined. */
  MESSAGE_NEW:      'message:new',
  /**
   * The other side opened the thread and read what was waiting.
   *
   * Carries who read rather than which messages: the reader marks everything
   * outstanding at once, so a list of ids would be the same information in a
   * form the sender has to diff against what it already has.
   */
  MESSAGES_READ:    'message:read',
  /** A message was withdrawn by the shop. Payload: { conversationId, messageId } */
  MESSAGE_DELETED:  'message:deleted',
  /**
   * Something arrived for you, wherever you are in the app.
   *
   * Addressed to the person rather than to a conversation, because the badge
   * and the toast are rendered by the sidebar — which is on every page and has
   * joined no conversation room. Payload: { conversationId, from, preview }
   */
  INBOX_CHANGED:    'inbox:changed',
  /** Someone's online state changed. */
  PRESENCE_UPDATE:  'presence:update',
  /** Answer to PRESENCE_QUERY — the full state for the ids that were asked for. */
  PRESENCE_STATE:   'presence:state',
  /** A join was refused. Payload: { conversationId, reason } */
  JOIN_DENIED:      'conversation:denied',
} as const;

/** One user's presence, as both the query answer and the push carry it. */
export interface PresenceState {
  userId: string;
  online: boolean;
  /**
   * ISO timestamp of when they were last connected. Null when they are online
   * (ask again when they go offline) or when they have never connected since
   * the column was added.
   */
  lastSeenAt: string | null;
}

/**
 * How long a presence key outlives its socket.
 *
 * Longer than socket.io's own ping cycle so a slow heartbeat does not blink
 * someone offline, short enough that an API killed with SIGKILL leaves stale
 * "online" flags for at most this long.
 */
export const PRESENCE_TTL_SECONDS = 120;

/** How often the gateway re-stamps the TTL for sockets it still holds. */
export const PRESENCE_REFRESH_SECONDS = 45;

/**
 * An idempotency key for one send attempt.
 *
 * Generated once when the user presses send and reused for every retry of that
 * same message, so the server can tell "they sent it twice" from "the first
 * request timed out on the way back". Without it a slow connection turns one
 * message into two, which needs no scale at all — one person on flaky mobile
 * data is enough.
 *
 * crypto.randomUUID where the browser has it, which is everywhere with a
 * secure context. The fallback exists because it is absent on plain http
 * origins, which is exactly how the app runs in local development, and a
 * composer that throws on send would be a strange way to find that out.
 */
export function newClientMessageId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
