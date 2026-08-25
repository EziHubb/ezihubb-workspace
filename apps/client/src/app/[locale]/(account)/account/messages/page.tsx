'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import type { ConversationDto } from '@ezihubb/types';
import { ShopAvatar } from '../../../../../components/messages/ShopAvatar';
import { firstLinkIn, isOnlyLink } from '@ezihubb/utils';
import { MessageShopModal } from '../../../../../components/messages/MessageShopModal';
import { MessageThread } from '../../../../../components/messages/MessageThread';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(
  dateStr: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations<'account.messages'>>,
): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60_000);
  const hr   = Math.floor(diff / 3_600_000);
  const day  = Math.floor(diff / 86_400_000);
  if (min < 1)  return t('justNow');
  if (min < 60) return t('minutesAgo', { count: min });
  if (hr  < 24) return t('hoursAgo', { count: hr });
  if (day < 7)  return t('daysAgo', { count: day });
  return new Date(dateStr).toLocaleDateString(locale);
}


/** Hostname without "www.", for the one-line summary of a link-only message. */
function hostOf(url: string): string {
  try { return new URL(url.trim()).hostname.replace(/^www\./, ''); } catch { return url; }
}


// ── Skeletons ─────────────────────────────────────────────────────────────────

function ConversationListSkeleton() {
  return (
    <div className="divide-y animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-border/30 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-border/30 rounded w-32" />
            <div className="h-3 bg-border/30 rounded w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}


// ── ConversationListItem ───────────────────────────────────────────────────────

function ConversationListItem({
  conversation: conv,
  isSelected,
  onClick,
}: {
  conversation: ConversationDto;
  isSelected:   boolean;
  onClick:      () => void;
}) {
  const t = useTranslations('account.messages');
  const locale = useLocale();
  const hasUnread = conv.unreadByCustomer > 0;
  // The shop's own name, not a literal. Every row said "EziHubb" whichever
  // shop the thread was with — harmless on a one-shop marketplace and wrong
  // the day there are two.
  const shopName = conv.store?.name ?? 'Shop';
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left p-4 hover:bg-[#FAFAF8] transition-colors',
        isSelected ? 'bg-primary/5 border-l-2 border-primary' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <ShopAvatar name={shopName} src={conv.store?.logoUrl} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`truncate text-sm text-secondary ${hasUnread ? 'font-semibold' : 'font-medium'}`}>
              {shopName}
            </span>
            <span className="text-xs text-muted flex-shrink-0 ml-2">
              {formatRelativeTime(conv.lastMessageAt, locale, t)}
            </span>
          </div>
          {conv.order && (
            <p className="text-xs text-muted">{t('orderNumber', { number: conv.order.orderNumber })}</p>
          )}
          {/* A row whose last message is a bare URL used to read
              "https://ezihubb.com/en/products/princ…" — a truncation that
              says nothing about which shop or which thing. The host is the
              part that survives truncation with meaning intact. */}
          <p className={`text-xs mt-0.5 truncate ${hasUnread ? 'font-medium text-secondary' : 'text-muted'}`}>
            {conv.lastMessage && isOnlyLink(conv.lastMessage, firstLinkIn(conv.lastMessage))
              ? `🔗 ${hostOf(conv.lastMessage)}`
              : conv.lastMessage}
          </p>
        </div>
        {hasUnread && (
          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
        )}
      </div>
    </button>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const t = useTranslations('account.messages');
  const token = useAuthStore((s) => s.accessToken);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const { data: conversations, isLoading } = useQuery<ConversationDto[]>({
    queryKey: ['conversations'],
    queryFn: () =>
      apiClient.get<ConversationDto[]>(API_ROUTES.MESSAGES.CONVERSATIONS, { token: token ?? undefined }),
    refetchInterval: 30_000,
    enabled: !!token,
  });

  const convList = conversations ?? [];

  return (
    // A bounded, framed box rather than a bare region that grows.
    //
    // It was `h-full min-h-[600px]`: h-full resolves against a parent with no
    // height of its own, so the box simply took its content's height and the
    // panes inside could never scroll — a long thread ran down the page and
    // left the composer stranded under the footer, with a wide empty band
    // above it on short threads. A viewport-relative height gives the panes
    // something to scroll inside, and the border makes the chat read as one
    // object instead of floating text on the page.
    <div className="flex h-[calc(100vh-11rem)] min-h-[30rem] overflow-hidden rounded-card border border-border bg-surface">
      {/* ── Conversation list ── */}
      <div className={[
        'w-full md:w-[320px] md:flex-shrink-0 border-r flex flex-col',
        selectedId ? 'hidden md:flex' : 'flex',
      ].join(' ')}>
        <div className="p-4 border-b">
          <h2 className="font-semibold text-secondary">{t('title')}</h2>
        </div>

        {isLoading ? (
          <ConversationListSkeleton />
        ) : convList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <svg className="w-12 h-12 text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="font-medium text-secondary mb-1">{t('noMessages')}</p>
            <p className="text-sm text-muted">
              {t('questionsHint')}{' '}
              <button
                onClick={() => setIsComposeOpen(true)}
                className="text-primary hover:underline"
              >
                {t('messageUs')}
              </button>
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y">
            {convList.map((conv) => (
              <ConversationListItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedId === conv.id}
                onClick={() => setSelectedId(conv.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Message thread ──
          min-w-0 is what keeps this column inside the frame, and it is not
          optional. A flex item defaults to min-width:auto, which means it
          refuses to shrink below its content's min-content width — and a link
          preview card's title carries `truncate`, so its min-content width is
          the WHOLE title. Without this the column grew past the frame and the
          parent's overflow-hidden simply cut the conversation off at the right
          edge: header, messages and composer all clipped. Truncation cannot
          rescue a container nothing is constraining. */}
      <div className={[
        'flex-1 min-w-0 flex flex-col',
        selectedId ? 'flex' : 'hidden md:flex',
      ].join(' ')}>
        {/* MessageThread is keyed by the conversation so switching remounts it
            instead of feeding a new id to the old instance. Without the key the
            composer keeps its draft AND its already-uploaded attachments across
            the switch, so a file picked for one shop can be sent to the next. */}
        {selectedId ? (
          <MessageThread
            key={selectedId}
            conversationId={selectedId}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <svg className="w-16 h-16 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-secondary font-medium">{t('selectConversation')}</p>
            </div>
          </div>
        )}
      </div>

      <MessageShopModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
      />
    </div>
  );
}
