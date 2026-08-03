'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Check, RefreshCw } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import type { ConversationDto, ConversationWithMessagesDto } from '@ezihubb/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminConvList {
  items: ConversationDto[];
  meta:  { total: number; page: number; limit: number; totalPages: number };
}

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

function customerLabel(conv: ConversationDto): string {
  if (conv.user) {
    const name = `${conv.user.firstName ?? ''} ${conv.user.lastName ?? ''}`.trim();
    return name || conv.user.email;
  }
  return conv.guestName ?? conv.guestEmail ?? 'Guest';
}

// ── Status dot ────────────────────────────────────────────────────────────────

function ConvStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN:     'bg-green-500',
    PENDING:  'bg-amber-500',
    RESOLVED: 'bg-gray-300',
    SPAM:     'bg-red-400',
  };
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] ?? 'bg-gray-300'}`} />;
}

// ── Conversation list item ────────────────────────────────────────────────────

function AdminConversationItem({
  conversation: conv,
  isSelected,
  onClick,
}: {
  conversation: ConversationDto;
  isSelected:   boolean;
  onClick:      () => void;
}) {
  const hasUnread = conv.unreadByAdmin > 0;
  const name      = customerLabel(conv);

  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left p-4 hover:bg-[#FAFAF8] transition-colors relative',
        isSelected ? 'bg-primary/5 border-l-[3px] border-primary' : 'border-l-[3px] border-transparent',
      ].join(' ')}
    >
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
          {(name[0] ?? 'G').toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`text-sm truncate ${hasUnread ? 'font-bold' : 'font-medium'} text-secondary`}>
              {name}
            </span>
            <span className="text-[10px] text-muted flex-shrink-0">
              {formatRelativeTime(conv.lastMessageAt)}
            </span>
          </div>
          {conv.order && (
            <p className="text-xs text-muted">Order #{conv.order.orderNumber}</p>
          )}
          <p className={`text-xs mt-0.5 truncate ${hasUnread ? 'font-semibold text-secondary' : 'text-muted'}`}>
            {conv.lastMessage}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <ConvStatusDot status={conv.status} />
          {hasUnread && (
            <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center text-white text-[9px] font-bold">
              {conv.unreadByAdmin > 9 ? '9+' : conv.unreadByAdmin}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function AdminMessageBubble({ msg }: { msg: ConversationWithMessagesDto['messages'][number] }) {
  if (msg.senderType === 'SYSTEM') {
    return (
      <div className="text-center text-xs text-muted py-2">
        <span className="bg-white px-3 py-1 rounded-full border">{msg.body}</span>
      </div>
    );
  }
  const isShop = msg.senderType === 'SHOP';
  return (
    <div className={`flex gap-2 ${isShop ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={[
        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1',
        isShop ? 'bg-primary/20 text-primary' : 'bg-[#E5E7EB] text-secondary',
      ].join(' ')}>
        {isShop ? 'ML' : 'C'}
      </div>
      <div className={[
        'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm',
        isShop
          ? 'bg-primary text-white rounded-tr-sm'
          : 'bg-white text-secondary rounded-tl-sm shadow-sm',
      ].join(' ')}>
        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        {msg.attachmentUrls?.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {msg.attachmentUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt="Attachment" className="w-20 h-20 rounded-lg object-cover hover:opacity-80" />
              </a>
            ))}
          </div>
        )}
        <p className={`text-[10px] mt-1 ${isShop ? 'text-white/70' : 'text-muted'}`}>
          {formatTime(msg.createdAt)}
          {isShop && msg.isRead && <span className="ml-1">✓✓</span>}
        </p>
      </div>
    </div>
  );
}

// ── Message thread ────────────────────────────────────────────────────────────

function AdminMessageThread({
  conversationId,
  onStatusChange,
}: {
  conversationId: string;
  onStatusChange: () => void;
}) {
  const [replyText,   setReplyText]   = useState('');
  const [isSending,   setIsSending]   = useState(false);
  const [statusMsg,   setStatusMsg]   = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conv, isLoading } = useQuery<ConversationWithMessagesDto>({
    queryKey: ['admin-conversation', conversationId],
    queryFn:  () => api.get<ConversationWithMessagesDto>(API_ROUTES.ADMIN.CONVERSATION(conversationId)),
    refetchInterval: 15_000,
    enabled: !!conversationId,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv?.messages?.length]);

  const sendReply = async () => {
    const body = replyText.trim();
    if (!body || isSending) return;
    setIsSending(true);
    try {
      await api.post(API_ROUTES.ADMIN.CONVERSATION_MESSAGES(conversationId), { body });
      setReplyText('');
      queryClient.invalidateQueries({ queryKey: ['admin-conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['admin-conversations'] });
    } finally {
      setIsSending(false);
    }
  };

  const updateStatus = async (status: string) => {
    await api.patch(API_ROUTES.ADMIN.CONVERSATION_STATUS(conversationId), { status });
    queryClient.invalidateQueries({ queryKey: ['admin-conversation', conversationId] });
    onStatusChange();
    setStatusMsg(`Marked as ${status.toLowerCase()}`);
    setTimeout(() => setStatusMsg(''), 2500);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const name = conv ? customerLabel(conv) : '';

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b bg-white flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-secondary">{name}</span>
            {conv?.user?.email && (
              <span className="text-xs text-muted">{conv.user.email}</span>
            )}
            {conv?.order && (
              <Link
                href={`/orders/${conv.order.id}`}
                className="text-xs text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-full"
              >
                Order #{conv.order.orderNumber}
              </Link>
            )}
          </div>
          {conv?.subject && (
            <p className="text-xs text-muted mt-0.5">{conv.subject}</p>
          )}
        </div>

        {/* Status actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {statusMsg && (
            <span className="text-xs text-green-600 font-medium">{statusMsg}</span>
          )}
          {conv?.status !== 'RESOLVED' ? (
            <button
              type="button"
              onClick={() => updateStatus('RESOLVED')}
              className="flex items-center gap-1 text-xs font-medium text-green-700 border border-green-200 hover:bg-green-50 px-3 py-1.5 rounded-button transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Resolve
            </button>
          ) : (
            <button
              type="button"
              onClick={() => updateStatus('OPEN')}
              className="flex items-center gap-1 text-xs font-medium text-secondary border border-border hover:border-primary/40 px-3 py-1.5 rounded-button transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reopen
            </button>
          )}
          <button
            type="button"
            onClick={() => updateStatus('SPAM')}
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
          >
            Spam
          </button>
          {conv?.user && (
            <Link
              href={`/customers/${conv.user.id}`}
              target="_blank"
              className="text-xs text-muted hover:text-secondary hover:underline"
            >
              Customer profile ↗
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#FAFAF8]">
        {conv?.messages?.map((msg) => (
          <AdminMessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div className="p-4 border-t bg-white flex-shrink-0">
        <div className="border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply();
            }}
            placeholder="Type a reply... (Cmd+Enter to send)"
            rows={3}
            className="w-full px-4 py-3 text-sm resize-none outline-none bg-white"
          />
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#F9FAFB] border-t">
            <p className="text-xs text-muted">
              Sending as <span className="font-medium">EziHubb</span>
            </p>
            <button
              type="button"
              disabled={!replyText.trim() || isSending}
              onClick={sendReply}
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-white px-3 py-1.5 rounded-button hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSending ? (
                <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Send reply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminMessagesPage() {
  const searchParams = useSearchParams();
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [statusFilter,  setStatusFilter]  = useState('');
  const [search,        setSearch]        = useState('');
  const [debouncedSearch, setDebounced]   = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queryClient = useQueryClient();

  // Debounce search — same pattern as orders page
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Unfiltered query — always fetches everything for accurate badge/tab counts.
  // queryKey starts with 'admin-conversations' so existing invalidateQueries calls cover it.
  const { data: allData } = useQuery<AdminConvList>({
    queryKey: ['admin-conversations', 'counts'],
    queryFn:  () => api.get<AdminConvList>(`${API_ROUTES.ADMIN.CONVERSATIONS}?limit=100`),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data, isLoading } = useQuery<AdminConvList>({
    queryKey: ['admin-conversations', statusFilter, debouncedSearch],
    queryFn:  () => {
      const params = new URLSearchParams();
      if (statusFilter)    params.set('status', statusFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      return api.get<AdminConvList>(`${API_ROUTES.ADMIN.CONVERSATIONS}?${params.toString()}`);
    },
    refetchInterval: 30_000,
  });

  const conversations   = data?.items ?? [];
  const allConversations = allData?.items ?? [];
  const unreadTotal     = allConversations.filter((c) => c.unreadByAdmin > 0).length;
  const openCount       = allConversations.filter((c) => c.status === 'OPEN').length;
  const pendingCount    = allConversations.filter((c) => c.status === 'PENDING').length;
  const resolvedCount   = allConversations.filter((c) => c.status === 'RESOLVED').length;

  // Auto-select from orderId query param
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId && conversations.length > 0) {
      const conv = conversations.find((c) => c.orderId === orderId);
      if (conv) setSelectedId(conv.id);
    }
  }, [searchParams, conversations]);

  return (
    /* Break out of main's p-6 lg:p-8 to fill full height */
    <div className="flex -mx-6 -my-6 lg:-mx-8 lg:-my-8 bg-white" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── Left: Conversation list ── */}
      <div className="w-[340px] flex-shrink-0 border-r flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-secondary">Messages</h2>
            {unreadTotal > 0 && (
              <span className="bg-primary text-white text-xs font-bold rounded-full px-2 py-0.5">
                {unreadTotal} unread
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, order..."
              className="w-full border rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {[
              { value: '',         label: 'All'     },
              { value: 'OPEN',     label: openCount    > 0 ? `Open (${openCount})`     : 'Open'     },
              { value: 'PENDING',  label: pendingCount > 0 ? `Pending (${pendingCount})`: 'Pending'  },
              { value: 'RESOLVED', label: resolvedCount > 0 ? `Resolved (${resolvedCount})` : 'Resolved' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={[
                  'flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors',
                  statusFilter === tab.value
                    ? 'bg-secondary text-white'
                    : 'text-muted hover:text-secondary hover:bg-[#F3F4F6]',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                  </div>
                </div>
              </div>
            ))
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              No conversations found
            </div>
          ) : (
            conversations.map((conv) => (
              <AdminConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedId === conv.id}
                onClick={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: Thread ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedId ? (
          <AdminMessageThread
            conversationId={selectedId}
            onStatusChange={() => queryClient.invalidateQueries({ queryKey: ['admin-conversations'] })}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <svg className="w-16 h-16 text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="font-medium text-secondary mb-1">Select a conversation</p>
            <p className="text-sm text-muted">Click any message on the left to start reading</p>
          </div>
        )}
      </div>
    </div>
  );
}
