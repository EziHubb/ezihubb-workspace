'use client';

import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import { API_ROUTES } from '@ezihubb/constants';
import { queryKeys } from '../queryKeys';
import type { WishlistItemDto } from '@ezihubb/types';

const DEBOUNCE_MS = 450;

interface Pending {
  timeout:       ReturnType<typeof setTimeout>;
  desiredActive: boolean;
  // Snapshot from before the rapid-click sequence — used for rollback on error
  rollback:      WishlistItemDto[];
}

/**
 * Returns a `toggle(productId, isCurrentlyWishlisted)` function that:
 *  - Immediately updates the React Query cache for instant visual feedback
 *  - Debounces the API call to prevent rapid-click spam
 *  - Tracks intermediate desired state across rapid clicks so only one API
 *    call fires with the final desired state after the debounce window
 *  - Rolls back the cache on error (except ERR_ALREADY_IN_WISHLIST)
 */
export function useWishlistToggle() {
  const qc      = useQueryClient();
  const KEY     = queryKeys.wishlist();
  const pending = useRef(new Map<string, Pending>());

  const toggle = useCallback(
    (productId: string, isCurrentlyWishlisted: boolean) => {
      const existing   = pending.current.get(productId);

      // Read live cache as source of truth — avoids adding when the item is
      // already wishlisted but the query hasn't returned yet (race on first load).
      const cacheItems  = qc.getQueryData<WishlistItemDto[]>(KEY);
      const isInCache   = cacheItems !== undefined
        ? cacheItems.some((w) => w.productId === productId)
        : isCurrentlyWishlisted;

      const currentDesired = existing?.desiredActive ?? isInCache;
      const nextDesired    = !currentDesired;

      // Preserve the pre-interaction snapshot so we can roll back on failure
      const rollback = existing?.rollback ?? (qc.getQueryData<WishlistItemDto[]>(KEY) ?? []);

      if (existing) clearTimeout(existing.timeout);

      // ── Immediate cache update → instant visual feedback ───────────────────
      if (nextDesired) {
        qc.setQueryData<WishlistItemDto[]>(KEY, (old = []) => {
          if (old.some((w) => w.productId === productId)) return old;
          return [
            ...old,
            {
              id:       `opt-${productId}`,
              productId,
              addedAt:  new Date().toISOString(),
              product:  { id: productId, name: '', slug: '', basePrice: 0, isActive: true },
            },
          ];
        });
      } else {
        qc.setQueryData<WishlistItemDto[]>(KEY, (old = []) =>
          old.filter((w) => w.productId !== productId),
        );
      }

      // ── Debounced API call ─────────────────────────────────────────────────
      const timeout = setTimeout(async () => {
        try {
          if (nextDesired) {
            await api.post(API_ROUTES.USERS.WISHLIST_ITEM(productId));
          } else {
            await api.delete(API_ROUTES.USERS.WISHLIST_ITEM(productId));
          }
        } catch (err) {
          const code = (err as { code?: string }).code;
          // Already wishlisted → our optimistic state is correct, no rollback needed
          if (code !== 'ERR_ALREADY_IN_WISHLIST') {
            qc.setQueryData(KEY, rollback);
          }
        } finally {
          void qc.invalidateQueries({ queryKey: KEY });
          pending.current.delete(productId);
        }
      }, DEBOUNCE_MS);

      pending.current.set(productId, { timeout, desiredActive: nextDesired, rollback });
    },
    [qc, KEY],
  );

  return toggle;
}
