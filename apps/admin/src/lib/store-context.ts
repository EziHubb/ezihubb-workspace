'use client';

import { useEffect, useState } from 'react';
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
export const STORE_CONTEXT_COOKIE = 'ezihubb-store-context';
const COOKIE_NAME = STORE_CONTEXT_COOKIE;
const CHANGE_EVENT = 'ezihubb-store-context-change';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const STORE_CONTEXT_HEADER = 'X-Store-Context';

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
  const inStoreMode = canSwitchToOwnStore && activeStoreContext === ownStoreId;
  const isPlatformContext = isSuperAdmin && !inStoreMode;

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (activeStoreContext && activeStoreContext !== ownStoreId) setStoreContext(null);
  }, [status, activeStoreContext, ownStoreId]);

  return { role, ownStoreId, isSuperAdmin, canSwitchToOwnStore, inStoreMode, isPlatformContext };
}
