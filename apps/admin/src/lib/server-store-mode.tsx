'use client';

import { createContext, useContext } from 'react';

/**
 * The store context as the SERVER decided it for this request.
 *
 * Both halves of the admin used to answer "am I viewing my own store?"
 * independently: the layout and every Server Component read the cookie through
 * `cookies()`, while the sidebar and every client page read `document.cookie`.
 * Two reads, two runtimes, one question — and when they disagreed the result
 * was a page that contradicted itself: the seller's navigation beside the
 * platform-wide dashboard, each half certain it was right.
 *
 * The server's answer is the one that matters, because it is the answer the
 * page content was rendered from and the one the API is scoped by. Publishing
 * it here lets the client agree with what is already on screen instead of
 * recomputing and possibly differing.
 *
 * Null means no server answer was provided — the hook then falls back to
 * reading the cookie, which is what a page rendered outside this provider has
 * to do.
 */
const ServerStoreModeContext = createContext<boolean | null>(null);

export function ServerStoreModeProvider({
  inStoreMode,
  children,
}: {
  inStoreMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <ServerStoreModeContext.Provider value={inStoreMode}>
      {children}
    </ServerStoreModeContext.Provider>
  );
}

export function useServerStoreMode(): boolean | null {
  return useContext(ServerStoreModeContext);
}
