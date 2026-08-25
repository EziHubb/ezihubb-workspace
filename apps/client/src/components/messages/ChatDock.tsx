'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ConversationDto } from '@ezihubb/types';
import { useAuthStore } from '../../lib/store/auth.store';
import { useChatDock } from '../../lib/store/chat-dock.store';
import { ShopAvatar } from './ShopAvatar';
import { MessageThread } from './MessageThread';

/** How many recent conversations the picker offers. */
const PICKER_LIMIT = 6;

function shopNameOf(conv: ConversationDto | undefined): string {
  return conv?.store?.name ?? 'Shop';
}

/**
 * The floating conversation dock.
 *
 * Keeps a thread reachable from wherever the buyer happens to be, which the
 * inbox page cannot do — reaching it means leaving the product they were
 * looking at, and the question they wanted to ask was about that product.
 *
 * It renders the same MessageThread the inbox page does rather than a reduced
 * copy, so attachments, link previews, unsend, pagination and the typing
 * indicator all behave identically in both places instead of drifting apart.
 */
export function ChatDock() {
  const t         = useTranslations('account.messages.dock');
  const token     = useAuthStore((s) => s.accessToken);
  const pathname  = usePathname();
  const [picking, setPicking] = useState(false);

  const openIds           = useChatDock((s) => s.openIds);
  const activeId          = useChatDock((s) => s.activeId);
  const expanded          = useChatDock((s) => s.expanded);
  const openConversation  = useChatDock((s) => s.openConversation);
  const closeConversation = useChatDock((s) => s.closeConversation);
  const setActive         = useChatDock((s) => s.setActive);
  const collapse          = useChatDock((s) => s.collapse);
  const prune             = useChatDock((s) => s.prune);

  // Two reasons to render nothing at all:
  //  - No token. A guest cannot open a socket (the handshake refuses one
  //    without a JWT), so a dock for them would be a chat box that never
  //    receives anything. MessageShopModal remains their way to write in.
  //  - The inbox page IS this thread. A floating copy of it there would put
  //    the same live conversation on screen twice.
  const onInboxPage = pathname?.includes('/account/messages') ?? false;
  const enabled     = !!token && !onInboxPage;

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn:  () =>
      apiClient.get<ConversationDto[]>(API_ROUTES.MESSAGES.CONVERSATIONS, { token: token ?? undefined }),
    // The same key the inbox page uses, so both read one cache. They never
    // mount together — the dock is disabled on that page — so sharing it does
    // not double the polling. Slower than the page's own interval because the
    // realtime push already covers the urgent path; this is only the fallback
    // for a socket that failed to open.
    refetchInterval: 60_000,
    enabled,
  });

  // Conversations are docked in localStorage, so an id can outlive the
  // conversation — deleted since, or belonging to whoever was signed in on this
  // browser before. Filtering below already hides them; this clears them out so
  // they do not sit in storage for good.
  useEffect(() => {
    if (!conversations) return; // only act on a successful fetch, never on an error
    prune(new Set(conversations.map((c) => c.id)));
  }, [conversations, prune]);

  if (!enabled) return null;

  const list   = conversations ?? [];
  const byId   = new Map(list.map((c) => [c.id, c]));
  const unread = list.reduce((n, c) => n + (c.unreadByCustomer || 0), 0);

  // Filtered through the fetched list, so a conversation that was deleted or
  // is not yet loaded simply does not appear rather than rendering an empty
  // panel for an id that no longer resolves.
  const docked     = openIds.map((id) => byId.get(id)).filter((c): c is ConversationDto => !!c);
  const activeConv = activeId ? byId.get(activeId) : undefined;
  const isOpen     = expanded && !!activeConv;

  return (
    <>
      {isOpen && activeConv && (
        <div
          className="
            fixed inset-0 z-50 flex flex-col bg-surface
            md:inset-auto md:bottom-4 md:right-4 md:h-[560px] md:w-[380px]
            md:rounded-card md:border md:border-border md:shadow-floating md:overflow-hidden
          "
          role="dialog"
          aria-label={t('title')}
        >
          {/* Head row — switching between docked conversations without
              collapsing first, the way the row of heads works on Android. */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2 flex-shrink-0">
            {docked.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActive(c.id)}
                  aria-label={shopNameOf(c)}
                  aria-current={isActive ? 'true' : undefined}
                  className={[
                    'relative rounded-full transition',
                    isActive ? 'ring-2 ring-primary' : 'opacity-60 hover:opacity-100',
                  ].join(' ')}
                >
                  <ShopAvatar name={shopNameOf(c)} src={c.store?.logoUrl} size={28} />
                  {c.unreadByCustomer > 0 && !isActive && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-error ring-2 ring-surface" />
                  )}
                </button>
              );
            })}

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={collapse}
                aria-label={t('minimise')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-muted/10 hover:text-secondary"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth={2} d="M5 12h14" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => closeConversation(activeConv.id)}
                aria-label={t('close')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-muted/10 hover:text-secondary"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* MessageThread returns a fragment and sizes itself from this
              column, which is why the frame is set here and not by it. */}
          <MessageThread
            key={activeConv.id}
            conversationId={activeConv.id}
            onBack={() => closeConversation(activeConv.id)}
          />
        </div>
      )}

      {/* Picker — what the launcher opens when nothing is docked yet. */}
      {picking && !isOpen && (
        <div className="fixed bottom-36 right-4 z-50 w-[280px] overflow-hidden rounded-card border border-border bg-surface shadow-floating md:bottom-20">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium text-secondary">{t('title')}</span>
            <button
              type="button"
              onClick={() => setPicking(false)}
              aria-label={t('close')}
              className="text-muted hover:text-secondary"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {list.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">{t('empty')}</p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {list.slice(0, PICKER_LIMIT).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => { openConversation(c.id); setPicking(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/5"
                  >
                    <ShopAvatar name={shopNameOf(c)} src={c.store?.logoUrl} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-secondary">{shopNameOf(c)}</span>
                      <span className="block truncate text-xs text-muted">{c.lastMessage ?? ''}</span>
                    </span>
                    {c.unreadByCustomer > 0 && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-error" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/account/messages"
            onClick={() => setPicking(false)}
            className="block border-t border-border px-3 py-2 text-center text-xs text-primary hover:underline"
          >
            {t('viewAll')}
          </Link>
        </div>
      )}

      {/* Launcher. bottom-20 on mobile clears the fixed MobileBottomNav (h-16);
          on desktop that bar is gone and it sits in the corner. */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            // Aim at a conversation the fetched list can actually resolve.
            // Using activeId blindly made the button dead when it pointed at a
            // conversation since deleted: expanded went true, the panel found
            // nothing to show, and every further click repeated that.
            const target = activeConv?.id ?? docked[docked.length - 1]?.id;
            if (target) { setActive(target); return; }
            setPicking((p) => !p);
          }}
          aria-label={t('open')}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-floating transition hover:brightness-110 md:bottom-4"
        >
          {docked.length > 0 ? (
            <span className="flex -space-x-2">
              {docked.slice(-2).map((c) => (
                <ShopAvatar key={c.id} name={shopNameOf(c)} src={c.store?.logoUrl} size={28} />
              ))}
            </span>
          ) : (
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          )}

          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1 text-[11px] font-semibold text-white ring-2 ring-surface">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      )}
    </>
  );
}
