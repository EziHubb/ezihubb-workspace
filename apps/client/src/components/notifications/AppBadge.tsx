'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ConversationDto } from '@ezihubb/types';
import { useAuthStore } from '../../lib/store/auth.store';

/**
 * The unread count on the installed app's icon, while the app is open.
 *
 * The service worker draws it when the app is closed, from the number carried
 * in the push payload. This is the other half: once the app is open the worker
 * hears nothing, and the count has to follow what the user is actually reading.
 *
 * Deliberately the ONLY place the badge is written from the page. Two writers
 * racing each other is how an icon ends up showing a number the app does not.
 *
 * Support is uneven and the guard is not decoration: iOS 16.4+ and desktop
 * Chrome implement it, Chrome on Android does not implement it at all. On iOS
 * it also needs the app installed to the Home Screen AND notification
 * permission granted — so a signed-in user in a Safari tab sets nothing here,
 * which is correct, because there is no icon to draw on.
 */
export function AppBadge() {
  const token = useAuthStore((s) => s.accessToken);

  // Same query key as the sidebar and the chat dock, so this reads their cache
  // rather than opening a third poll of the same endpoint.
  const { data: conversations } = useQuery<ConversationDto[]>({
    queryKey: ['conversations'],
    queryFn: () =>
      apiClient.get<ConversationDto[]>(API_ROUTES.MESSAGES.CONVERSATIONS, { token: token ?? undefined }),
    refetchInterval: 30_000,
    enabled: !!token,
    staleTime: 15_000,
  });

  const unread = (conversations ?? []).reduce((sum, c) => sum + c.unreadByCustomer, 0);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;

    // Signed out: the count is not ours to state, so leave the icon alone
    // rather than asserting zero on behalf of whoever signs in next.
    if (!token) return;

    const write = unread > 0
      ? navigator.setAppBadge(unread)
      : navigator.clearAppBadge();

    // Rejects when the app is not installed, which is the normal case in a
    // browser tab. Nothing to report and nothing to fall back to.
    void Promise.resolve(write).catch(() => undefined);
  }, [unread, token]);

  return null;
}
