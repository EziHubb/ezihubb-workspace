'use client';

import { useEffect, useState } from 'react';
import { useServerStoreMode } from './server-store-mode';
import { useSession } from 'next-auth/react';

// Lets a SUPER_ADMIN who also owns a store switch into that store's scope —
// mirrors the X-Store-Context header the backend's StoreContextService reads
// (apps/api/src/common/services/store-context.service.ts). Plain ADMIN shop
// owners never touch this; they're always scoped to their own store server-side.
//
// Stored as a cookie (not localStorage) because many admin pages are Server
// Components that fetch data server-side via `serverApi()` — a value that
// only lived in localStorage would be invisible to those requests, so the
// switcher would silently do nothing on any server-rendered page.
// Imported, not declared here, and deliberately not re-exported: see the note
// on the constants in store-context-shared.ts. Anything server-side must take
// them from that module, or it gets a client reference instead of the string.
import { STORE_CONTEXT_COOKIE } from './store-context-shared';

const COOKIE_NAME = STORE_CONTEXT_COOKIE;
const CHANGE_EVENT = 'ezihubb-store-context-change';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;


export function getStoreContext(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setStoreContext(storeId: string | null): void {
  if (typeof document === 'undefined') return;
  document.cookie = storeId
    ? `${COOKIE_NAME}=${encodeURIComponent(storeId)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
    : `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Reactive read of the current store context — re-renders when switched. */
export function useStoreContext(): string | null {
  const [value, setValue] = useState<string | null>(() => getStoreContext());

  useEffect(() => {
    const onChange = () => setValue(getStoreContext());
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
  }, []);

  return value;
}

// ── Derived admin-mode state ─────────────────────────────────────────────────

export interface AdminMode {
  role:                string;
  ownStoreId:          string;
  isSuperAdmin:        boolean;
  /** A SUPER_ADMIN who also owns a store — the only role that can toggle into "My Store" mode. */
  canSwitchToOwnStore: boolean;
  /** SUPER_ADMIN currently switched into their own store — scoped exactly like a shop owner. */
  inStoreMode:         boolean;
  /** True only for a SUPER_ADMIN NOT currently switched into their own store — mirrors the backend's StoreContext.isPlatformContext. */
  isPlatformContext:   boolean;
  /**
   * True once the session has actually resolved (`status !== 'loading'`).
   * `SessionProvider` isn't seeded with the SSR session, so on every page
   * load there's a brief window where `role`/`isPlatformContext` haven't
   * been determined yet and default to their "unknown" values (`''`/
   * `false`) — NOT necessarily the real ones. A query gated the opposite
   * way, e.g. `enabled: !isPlatformContext` (fire unless platform), reads
   * that transient `false` as "go ahead" and fires before the real value
   * (possibly `true`) is known, hitting a store-scoped endpoint with no
   * store and erroring. Any such gate must also require `isReady`.
   */
  isReady:             boolean;
}

/**
 * Single source of truth for "what admin mode is this session in" — reused by
 * the sidebar (which nav to show) and by any page that needs to know whether
 * it's being viewed platform-wide vs. scoped to one store.
 *
 * Also self-heals the store-context cookie: a stale value left over from a
 * different account (or an ownership change) can hold a storeId that no
 * longer matches this session's own store — the API rejects it with 403
 * even though the UI still (correctly) shows "Platform" mode, since the
 * cookie and the session are two independent sources of truth. Once the
 * real session is known, clear any mismatched cookie so it can't linger.
 */
export function useAdminMode(): AdminMode {
  const { data: session, status } = useSession();
  const user  = session?.user as Record<string, unknown> | undefined;
  const role  = (user?.['role']    as string) || '';
  const ownStoreId = (user?.['storeId'] as string) || '';

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const activeStoreContext = useStoreContext();
  const canSwitchToOwnStore = isSuperAdmin && !!ownStoreId;

  /**
   * The server's answer wins whenever there is one.
   *
   * This used to recompute the mode from `document.cookie` alone, in parallel
   * with the layout and every Server Component doing the same from
   * `cookies()`. Two independent answers to one question is a contradiction
   * waiting to be rendered — and it was: the seller's navigation beside the
   * platform dashboard, because the client said "my store" and the server that
   * rendered the page said "platform".
   *
   * Deferring here cannot make the mode wrong: whatever the server decided is
   * what the page below already reflects and what the API scoped its answers
   * by. The cookie read stays as the fallback for anything rendered outside
   * the provider.
   */
  const serverInStoreMode = useServerStoreMode();
  const cookieInStoreMode = canSwitchToOwnStore && activeStoreContext === ownStoreId;
  const inStoreMode = serverInStoreMode ?? cookieInStoreMode;

  const isPlatformContext = isSuperAdmin && !inStoreMode;

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (activeStoreContext && activeStoreContext !== ownStoreId) setStoreContext(null);
  }, [status, activeStoreContext, ownStoreId]);

  return {
    role, ownStoreId, isSuperAdmin, canSwitchToOwnStore, inStoreMode, isPlatformContext,
    isReady: status !== 'loading',
  };
}
