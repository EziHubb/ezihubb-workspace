'use client';

import { useEffect, useState } from 'react';

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
