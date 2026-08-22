'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Check } from 'lucide-react';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { Tooltip } from '@ezihubb/ui';
import { useAuthQuery, useAuthMutation } from '../../lib/hooks/useAuthQuery';
import { Badge } from './HeaderBadge';

interface NotificationDto {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  isRead:    boolean;
  createdAt: string;
}

/**
 * Bell + unread badge + recent-notification dropdown.
 *
 * Only rendered for a signed-in user: the feed endpoints are behind
 * JwtAuthGuard, so showing this to a guest would render a control whose every
 * request 401s.
 *
 * The list and the count are separate queries on purpose. The badge is the
 * only part most visits need, and it is a COUNT over an index; the list is a
 * page of rows nobody sees until the bell is opened. Fetching them together
 * would pay for the list on every page load to render a number.
 */
export function NotificationBell() {
  const t      = useTranslations('nav.notifications');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: countData } = useAuthQuery<{ count: number }>(
    ['notifications', 'unread-count'],
    API_ROUTES.NOTIFICATIONS.UNREAD_COUNT,
  );
  const unread = countData?.count ?? 0;

  // `enabled: open` — the list is not fetched until the dropdown is actually
  // opened, so a closed bell costs one cheap count query and nothing else.
  const { data: listData, isLoading } = useAuthQuery<{ items: NotificationDto[]; hasMore: boolean }>(
    ['notifications', 'list'],
    API_ROUTES.NOTIFICATIONS.LIST,
    // params is the THIRD argument; options is the fourth. Passing { enabled }
    // in the params slot would have sent it as a query string and left the
    // query permanently enabled.
    undefined,
    { enabled: open },
  );
  const items = listData?.items ?? [];

  const markAllRead = useAuthMutation(
    (_: void, token: string) =>
      apiClient.patch<void>(API_ROUTES.NOTIFICATIONS.READ_ALL, {}, { token }),
    { invalidateKeys: [['notifications', 'unread-count'], ['notifications', 'list']] },
  );

  // Close on outside click. Without this the panel stays open behind whatever
  // the shopper clicks next, which on a header dropdown means it covers the
  // page they just navigated to.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="relative hidden md:block" ref={ref}>
      {/* Same padding and glyph size as the wishlist and cart buttons, so the
          three read as one set of circles.

          The reference draws a caret beside its bell, and this had one. It was
          dropped: `p-2` plus a `w-3` caret measured 50px against the
          neighbours' 36px, so `rounded-full` produced a pill sitting in a row
          of circles and the gaps either side stopped matching. Every icon in
          the reference carries a caret, which is why it reads as even there;
          here only the avatar does, and that is a different kind of control.
          The unread badge already signals this one holds state. */}
      <Tooltip label={t('tip')} disabled={open}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={unread > 0 ? `${t('tip')} (${unread})` : t('tip')}
          aria-expanded={open}
          className="relative flex p-2 hover:bg-muted/10 rounded-full transition-colors"
        >
          <Bell className="w-5 h-5 text-secondary" />
          <Badge count={unread} />
        </button>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-border rounded-card shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <p className="text-sm font-semibold text-secondary">{t('title')}</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate(undefined)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Check className="w-3 h-3" /> {t('markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading && (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-10 rounded bg-muted/10" />
                ))}
              </div>
            )}

            {/* Empty is the normal state here, not a failure: notifications are
                only written by a handful of events, so most accounts have
                none. Says so plainly rather than showing a bare panel. */}
            {!isLoading && items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">{t('empty')}</p>
            )}

            {!isLoading && items.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-border last:border-0 ${n.isRead ? '' : 'bg-primary/4'}`}
              >
                <p className="text-sm font-medium text-secondary">{n.title}</p>
                <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.body}</p>
                <p className="text-[11px] text-muted mt-1">
                  {new Date(n.createdAt).toLocaleDateString(locale)}
                </p>
              </div>
            ))}
          </div>

          {/* No "view all" link: there is no /account/notifications page yet,
              and a link to a blank page is worse than no link. Add it back
              with the page. */}
        </div>
      )}
    </div>
  );
}
