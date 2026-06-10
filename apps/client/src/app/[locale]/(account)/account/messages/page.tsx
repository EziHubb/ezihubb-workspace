'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { useAuthStore } from '../../../../../lib/store/auth.store';
import type { ConversationDto, ConversationWithMessagesDto } from '@mlh/types';
import { MessageShopModal } from '../../../../../components/messages/MessageShopModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60_000);
  const hr   = Math.floor(diff / 3_600_000);
  const day  = Math.floor(diff / 86_400_000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  if (hr  < 24) return `${hr}h ago`;
  if (day < 7)  return `${day}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function MessageSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
          <div className="w-7 h-7 rounded-full bg-border/30 flex-shrink-0" />
          <div className={`h-10 rounded-2xl bg-border/30 ${i % 2 === 0 ? 'w-48' : 'w-36'}`} />
        </div>
      ))}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function ConversationStatusBadge({ status }: { status?: string }) {
  if (!status || status === 'OPEN') return null;
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: 'Pending',  cls: 'bg-yellow-100 text-yellow-700' },
    RESOLVED: { label: 'Resolved', cls: 'bg-green-100 text-green-700'   },
    SPAM:     { label: 'Spam',     cls: 'bg-gray-100 text-gray-500'      },
  };
  const cfg = map[status];
  if (!cfg) return null;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
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
  const hasUnread = conv.unreadByCustomer > 0;
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left p-4 hover:bg-[#FAFAF8] transition-colors',
        isSelected ? 'bg-primary/5 border-l-2 border-primary' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
          ML
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`text-sm text-secondary ${hasUnread ? 'font-semibold' : 'font-medium'}`}>
              MapleLoomHandmade
            </span>
            <span className="text-xs text-muted flex-shrink-0 ml-2">
              {formatRelativeTime(conv.lastMessageAt)}
            </span>
          </div>
          {conv.order && (
            <p className="text-xs text-muted">Order #{conv.order.orderNumber}</p>
          )}
          <p className={`text-xs mt-0.5 truncate ${hasUnread ? 'font-medium text-secondary' : 'text-muted'}`}>
            {conv.lastMessage}
          </p>
        </div>
        {hasUnread && (
          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
        )}
      </div>
    </button>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message: msg, isOwn }: {
  message: ConversationWithMessagesDto['messages'][number];
  isOwn:   boolean;
}) {
  const isSystem = msg.senderType === 'SYSTEM';
  if (isSystem) {
    return (
      <div className="text-center">
        <span className="text-xs text-muted italic bg-[#FAFAF8] px-3 py-1 rounded-full">
          {msg.body}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn && (
        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0 mt-1">
          ML
        </div>
      )}
      <div className={[
        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
        isOwn
          ? 'bg-primary text-white rounded-tr-sm'
          : 'bg-[#F3F4F6] text-secondary rounded-tl-sm',
      ].join(' ')}>
        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
        {msg.attachmentUrls?.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {msg.attachmentUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="Attachment" className="w-20 h-20 rounded-lg object-cover hover:opacity-80" />
              </a>
            ))}
          </div>
        )}
        <p className={`text-[10px] mt-1 ${isOwn ? 'text-white/70' : 'text-muted'}`}>
          {formatTime(msg.createdAt)}
          {isOwn && msg.isRead && <span className="ml-1">✓✓</span>}
        </p>
      </div>
    </div>
  );
}

// ── MessageThread ─────────────────────────────────────────────────────────────

function MessageThread({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack:         () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conv, isLoading } = useQuery<ConversationWithMessagesDto>({
    queryKey: ['conversation', conversationId],
    queryFn: () =>
      apiClient.get<ConversationWithMessagesDto>(API_ROUTES.MESSAGES.CONVERSATION(conversationId), {
        token: token ?? undefined,
      }),
    refetchInterval: 15_000,
    enabled: !!conversationId,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv?.messages?.length]);

  const sendMessage = async () => {
    const body = newMessage.trim();
    if (!body || isSending) return;
    setIsSending(true);
    try {
      await apiClient.post(API_ROUTES.MESSAGES.CONVERSATION_MESSAGES(conversationId), { body }, {
        token: token ?? undefined,
      });
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b flex-shrink-0">
        <button
          onClick={onBack}
          className="md:hidden w-8 h-8 flex items-center justify-center text-muted hover:text-secondary"
          aria-label="Back to conversations"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
            ML
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-secondary">MapleLoomHandmade</p>
            {conv?.order && (
              <p className="text-xs text-muted">Order #{conv.order.orderNumber}</p>
            )}
          </div>
        </div>
        <ConversationStatusBadge status={conv?.status} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <MessageSkeleton count={3} />
        ) : (
          conv?.messages?.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.senderType === 'CUSTOMER'}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {conv?.status !== 'RESOLVED' ? (
        <div className="p-4 border-t flex-shrink-0">
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Type a message... (Enter to send)"
              rows={2}
              className="flex-1 border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || isSending}
              className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 self-end"
              aria-label="Send message"
            >
              {isSending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-xs text-muted mt-1">Shift+Enter for new line</p>
        </div>
      ) : (
        <div className="p-4 border-t text-center">
          <p className="text-xs text-muted">
            This conversation has been resolved.{' '}
            <button
              onClick={() =>
                apiClient
                  .post(API_ROUTES.MESSAGES.CONVERSATION_MESSAGES(conversationId), { body: '(Reopening conversation)' }, { token: token ?? undefined })
                  .then(() => queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] }))
              }
              className="text-primary hover:underline"
            >
              Reopen
            </button>
          </p>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
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
    <div className="flex h-full -mx-4 md:mx-0 min-h-[600px]">
      {/* ── Conversation list ── */}
      <div className={[
        'w-full md:w-[320px] md:flex-shrink-0 border-r flex flex-col',
        selectedId ? 'hidden md:flex' : 'flex',
      ].join(' ')}>
        <div className="p-4 border-b">
          <h2 className="font-semibold text-secondary">Messages</h2>
        </div>

        {isLoading ? (
          <ConversationListSkeleton />
        ) : convList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <svg className="w-12 h-12 text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="font-medium text-secondary mb-1">No messages yet</p>
            <p className="text-sm text-muted">
              Questions about your orders or products?{' '}
              <button
                onClick={() => setIsComposeOpen(true)}
                className="text-primary hover:underline"
              >
                Message us
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

      {/* ── Message thread ── */}
      <div className={[
        'flex-1 flex flex-col',
        selectedId ? 'flex' : 'hidden md:flex',
      ].join(' ')}>
        {selectedId ? (
          <MessageThread
            conversationId={selectedId}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <svg className="w-16 h-16 text-muted mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-secondary font-medium">Select a conversation to read messages</p>
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
