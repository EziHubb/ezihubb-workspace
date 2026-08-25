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
  /**
   * "I have / no longer have an unsent draft in this thread."
   * Payload: { conversationId, typing: boolean }
   *
   * Reports the state of the box, not keystrokes. Someone who writes a line
   * and then stops to think is still composing a message to you, and an
   * indicator that vanished after a pause was reporting their typing speed
   * rather than the thing the reader cares about.
   *
   * Repeated while the draft stands rather than sent once, because the only
   * reliable way to clear it on the other side is for that side to stop
   * hearing it — see TYPING_EXPIRY_MS.
   */
  TYPING:             'conversation:typing',
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
  /** A message was unsent by the shop. Payload: { conversationId, messageId } */
  MESSAGE_DELETED:  'message:deleted',
  /**
   * Something arrived for you, wherever you are in the app.
   *
   * Addressed to the person rather than to a conversation, because the badge
   * and the toast are rendered by the sidebar — which is on every page and has
   * joined no conversation room. Payload: { conversationId, from, preview, avatarUrl }
   */
  INBOX_CHANGED:    'inbox:changed',
  /** Someone's online state changed. */
  PRESENCE_UPDATE:  'presence:update',
  /** Answer to PRESENCE_QUERY — the full state for the ids that were asked for. */
  PRESENCE_STATE:   'presence:state',
  /** A join was refused. Payload: { conversationId, reason } */
  JOIN_DENIED:      'conversation:denied',
  /**
   * The other party started or stopped composing.
   * Payload: { conversationId, userId, typing: boolean }
   *
   * A different name from the client's TYPING even though the direction alone
   * would disambiguate them: one socket is both a sender and a receiver, so
   * sharing the string would make a client's own emit indistinguishable from
   * an echo in a network log, which is exactly when you are reading one.
   */
  TYPING_UPDATE:    'conversation:typing:update',
} as const;

/**
 * How often a client holding an unsent draft re-announces itself.
 *
 * The indicator is cleared by silence rather than by a message, so this is
 * really "how stale the other side's view is allowed to get while the truth
 * has not changed". Driving it on a timer rather than on keystrokes also
 * means a long draft costs the same as a short one.
 */
export const TYPING_HEARTBEAT_MS = 2_500;

/**
 * How long a receiver keeps showing "typing…" without hearing a refresh.
 *
 * This is the part that must not be skipped. An explicit "stopped" covers the
 * polite exits — the draft was sent or cleared, the thread was closed — but
 * none of them run when the tab is killed, the laptop lid closes, or the
 * connection drops mid-word. In every one of those the last thing the other
 * side heard was "typing", and without an expiry it would display that
 * forever. Comfortably above the heartbeat so an ordinary late packet does
 * not blink the indicator off while a draft still stands.
 */
export const TYPING_EXPIRY_MS = 6_000;

/**
 * Server-side floor between two accepted "typing: true" packets from one
 * socket. Well under TYPING_HEARTBEAT_MS, so an honest client never trips it,
 * while a hostile one cannot turn a keystroke into an unbounded room
 * broadcast.
 */
export const TYPING_MIN_INTERVAL_MS = 500;

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
