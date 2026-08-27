'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive, Loader2, MailOpen, Mail, Search, ShieldAlert, Star, Tag, Trash2, Undo2, X,
} from 'lucide-react';
import { API_ROUTES, newClientMessageId } from '@ezihubb/constants';
import { api } from '../../../lib/api-client';
import { useAdminMode } from '../../../lib/store-context';
import { useConversationStream, usePresence, presenceLabel } from '../../../lib/realtime';
import { useDialog } from '../../../contexts/DialogContext';
import { AdminPageHeader } from '../../../components/layout/AdminPageHeader';
import { ConversationList } from '../../../components/messages/inbox/ConversationList';
import { ThreadView, type PendingReply } from '../../../components/messages/inbox/ThreadView';
import { BuyerPanel } from '../../../components/messages/inbox/BuyerPanel';
import { AutoReplyMenu } from '../../../components/messages/inbox/AutoReplyMenu';
import {
  FOLDERS, FOLDER_LABELS, LABEL_CHIP,
  type AutoReply, type BulkAction, type BuyerPanel as BuyerPanelData,
  type ConversationDetail, type ConversationLabel, type ConversationListResponse,
  type ConversationRow, type Folder, type FolderCounts,
  type MessagePage, type ThreadMessage,
} from '../../../components/messages/inbox/types';

/**
 * The shop's inbox.
 *
 * Folders on the left, threads in the middle, the open conversation and who
 * wrote it on the right. Folders are queries the server answers, not a field
 * on the thread, so the counts beside them and the list under them can never
 * disagree.
 */

const byOldest = (a: ThreadMessage, b: ThreadMessage) =>
  a.createdAt === b.createdAt
    ? a.id.localeCompare(b.id)
    : a.createdAt.localeCompare(b.createdAt);

/**
 * Everything the reader has seen, merged with the live newest window.
 *
 * Accumulating rather than concatenating "older pages + window" is what makes
 * a sliding window safe. The API returns the newest hundred, so on a thread of
 * a hundred and one a single new message pushes the oldest OUT of the window.
 * Concatenated, that message would belong to neither list and disappear from
 * the middle of a conversation the reader was in. Keyed by id, it stays: the
 * window only ever replaces a message with a fresher copy of itself.
 *
 * A ref, not state, so a refetch that changed nothing does not re-render the
 * thread; `tick` is what says the ref moved.
 */
function useThreadMessages(conversationId: string | null, newest: ThreadMessage[] | undefined) {
  const seen = useRef(new Map<string, ThreadMessage>());
  const [tick, setTick] = useState(0);

  // Cleared during render, not in an effect, so the previous buyer's messages
  // are never painted under the next one's name for a frame.
  const currentId = useRef(conversationId);
  if (currentId.current !== conversationId) {
    currentId.current = conversationId;
    seen.current = new Map();
  }

  /**
   * Merged during render, NOT in an effect — and this is a bug fix, not a
   * style choice.
   *
   * It used to be a useEffect keyed on `newest`. Effects run in declaration
   * order, so on the render where a thread first arrived carrying an unsent
   * message, this one filled the map and the reset below it emptied the map
   * again a moment later. Nothing refilled it: React Query hands back the SAME
   * array reference while the data is unchanged, so the effect's dependency
   * never moved again and the thread stayed blank until someone wrote in it.
   * Merging here cannot lose that race, because the render that follows a
   * reset performs the merge itself.
   *
   * Writing to the ref during render is safe here specifically because the
   * write is idempotent: the same `newest` merged twice leaves the same map.
   */
  if (newest) for (const m of newest) seen.current.set(m.id, m);

  const prepend = (older: ThreadMessage[]) => {
    for (const m of older) seen.current.set(m.id, m);
    setTick((n) => n + 1);
  };

  /** Drops everything outside the live window — used after a message is
   *  unsent, since a page fetched earlier still carries the text that was
   *  taken back. The next render restores the window from `newest`. */
  const reset = () => {
    seen.current = new Map();
    setTick((n) => n + 1);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const messages = useMemo(() => [...seen.current.values()].sort(byOldest), [newest, tick, conversationId]);
  // `merge` is `prepend` under a name that says what it does here: the map is
  // keyed by id and re-sorted by time, so it takes a page of older messages
  // and a single one that just arrived equally well.
  return { messages, prepend, merge: prepend, reset };
}

/** Delays a value so a fast typist causes one request, not twenty. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

const QK = {
  list:    (s: string | undefined, q: unknown) => ['messages-list', s, q] as const,
  folders: (s?: string) => ['message-folders', s] as const,
  labels:  (s?: string) => ['message-labels', s] as const,
  thread:  (id: string | null) => ['message-thread', id] as const,
  buyer:   (id: string | null) => ['message-buyer', id] as const,
  auto:    (s?: string) => ['message-auto-reply', s] as const,
};

export default function MessagesPage() {
  const { isPlatformContext, isReady } = useAdminMode();
  const dialog = useDialog();
  const qc = useQueryClient();

  const [folder,   setFolder]   = useState<Folder>('inbox');
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  /**
   * `?c=<id>` opens a thread directly — the order panel's "Open full
   * conversation" link, and a URL a seller can keep.
   *
   * Read off window rather than through useSearchParams: that hook forces the
   * page under a Suspense boundary or the Next build fails, and this is a
   * one-shot read on mount that needs neither. Written back with
   * history.replaceState for the same reason — no navigation, no re-render,
   * just an address bar that matches what is on screen.
   */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('c');
    if (id) setActiveId(id);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeId) url.searchParams.set('c', activeId);
    else url.searchParams.delete('c');
    window.history.replaceState(null, '', url);
  }, [activeId]);
  const [labelMenuOpen, setLabelMenuOpen] = useState(false);

  // Shop owners never send a storeId; the server ignores it for them. A
  // platform-context SUPER_ADMIN reads every shop's threads, which is a
  // support job — but the shop-owned writes below need a store, so they are
  // disabled in that mode rather than guessing one.
  //
  // The scope still has to reach the query keys. The server picks the shop off
  // a cookie the sidebar switcher writes, so a SUPER_ADMIN toggling between
  // Platform and My Store changes what every one of these endpoints returns
  // while the keys stay identical — and React Query would serve one context's
  // threads under the other.
  const scope = isPlatformContext ? 'platform' : 'own-store';
  const canWriteShopData = !isPlatformContext;

  // One request per keystroke otherwise, and this search reaches across every
  // thread's last message.
  const debouncedSearch = useDebounced(search, 300);

  const listQuery = useQuery({
    queryKey: QK.list(scope, { folder, search: debouncedSearch, page }),
    enabled:  isReady,
    queryFn:  () => {
      const p = new URLSearchParams({ folder, page: String(page), limit: '20' });
      if (debouncedSearch) p.set('search', debouncedSearch);
      return api.get<ConversationListResponse>(`${API_ROUTES.ADMIN.CONVERSATIONS}?${p}`);
    },
  });

  const foldersQuery = useQuery({
    queryKey: QK.folders(scope),
    enabled:  isReady,
    queryFn:  () => api.get<FolderCounts>(API_ROUTES.ADMIN.MESSAGE_FOLDERS),
  });

  const labelsQuery = useQuery({
    queryKey: QK.labels(scope),
    enabled:  isReady && canWriteShopData,
    queryFn:  () => api.get<ConversationLabel[]>(API_ROUTES.ADMIN.MESSAGE_LABELS),
  });

  const threadQuery = useQuery({
    queryKey: QK.thread(activeId),
    enabled:  Boolean(activeId),
    queryFn:  () => api.get<ConversationDetail>(API_ROUTES.ADMIN.CONVERSATION(activeId!)),
  });

  const thread0 = threadQuery.data;
  const { messages: threadMessages, prepend, merge, reset: resetPages } =
    useThreadMessages(activeId, thread0?.messages);

  /**
   * Where the next page back starts.
   *
   * Seeded from the thread's own response and then owned here, because that
   * response's cursor is the oldest message in the WINDOW — which walks
   * forwards as the thread grows, while this has to keep walking back.
   */
  const [cursor, setCursor] = useState<{ before: string | null; hasMore: boolean } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => { setCursor(null); setLoadingOlder(false); }, [activeId]);

  useEffect(() => {
    if (!thread0 || cursor) return;
    setCursor({ before: thread0.oldestMessageId ?? null, hasMore: thread0.hasMoreMessages ?? false });
  }, [thread0, cursor]);

  const loadOlder = async () => {
    if (!activeId || !cursor?.before || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await api.get<MessagePage>(
        `${API_ROUTES.ADMIN.CONVERSATION_MESSAGES(activeId)}?before=${encodeURIComponent(cursor.before)}`,
      );
      prepend(page.messages);
      setCursor({ before: page.oldestMessageId, hasMore: page.hasMoreMessages });
    } finally {
      setLoadingOlder(false);
    }
  };

  /**
   * An unsend invalidates history this page is holding.
   *
   * Pages already loaded were fetched before the shop took the message back,
   * so they still carry its text. Dropping them falls back to the live
   * window, which does not.
   */
  const unsentIds = useRef<string | null>(null);
  useEffect(() => {
    const ids = thread0?.messages?.filter((m) => m.deletedAt).map((m) => m.id).join(',') ?? '';
    if (unsentIds.current !== null && unsentIds.current !== ids) {
      resetPages();
      setCursor({ before: thread0?.oldestMessageId ?? null, hasMore: thread0?.hasMoreMessages ?? false });
    }
    unsentIds.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread0?.messages]);

  const buyerQuery = useQuery({
    queryKey: QK.buyer(activeId),
    enabled:  Boolean(activeId) && canWriteShopData,
    queryFn:  () => api.get<BuyerPanelData>(API_ROUTES.ADMIN.CONVERSATION_BUYER(activeId!)),
  });

  const autoReplyQuery = useQuery({
    queryKey: QK.auto(scope),
    enabled:  isReady && canWriteShopData,
    queryFn:  () => api.get<AutoReply>(API_ROUTES.ADMIN.MESSAGE_AUTO_REPLY),
  });

  const refetchLists = () => {
    qc.invalidateQueries({ queryKey: ['messages-list'] });
    qc.invalidateQueries({ queryKey: ['message-folders'] });
    // The sidebar's unread count is derived from the same thing these lists
    // are, but it is a separate query owned by AdminSidebar, so refreshing
    // these left it stale. Marking a thread read cleared the folder counts and
    // left "Messages 1" sitting in the nav beside the message being read.
    qc.invalidateQueries({ queryKey: ['sidebar-nav-badges'] });
  };

  /**
   * Anything that changes which threads are on screen clears the selection.
   *
   * The toolbar acts on ids, so a selection left over from another folder
   * would archive threads the seller can no longer see — the count would say
   * one thing and the action do another.
   */
  const changeView = (apply: () => void) => {
    apply();
    setPage(1);
    setSelected(new Set());
    setLabelMenuOpen(false);
  };

  const bulk = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkAction }) =>
      api.post(API_ROUTES.ADMIN.CONVERSATIONS_BULK, { conversationIds: ids, action }),
    onSuccess: () => {
      setSelected(new Set());
      refetchLists();
      qc.invalidateQueries({ queryKey: ['message-thread'] });
    },
    onError: (e: Error) => dialog.alert(e.message),
  });

  /**
   * Starring is its own mutation, not a `bulk` call.
   *
   * `bulk` clears the selection when it succeeds, which is right for filing —
   * those threads have left the folder. Starring leaves them exactly where
   * they are, so wiping a half-built selection because someone starred one row
   * is just losing their work.
   */
  const toggleStar = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      api.post(API_ROUTES.ADMIN.CONVERSATIONS_BULK, {
        conversationIds: [id],
        action: starred ? 'unstar' : 'star',
      }),
    onSuccess: () => {
      refetchLists();
      qc.invalidateQueries({ queryKey: ['message-thread'] });
    },
    onError: (e: Error) => dialog.alert(e.message),
  });

  /**
   * Replies drawn before the server has confirmed them.
   *
   * Sending cost two round trips before anything appeared — the POST, then a
   * refetch of the thread to read back what had just been sent. Matched to the
   * real row by clientMessageId, because there is no id until the server
   * answers and that wait is the thing being removed.
   */
  const [pending, setPending] = useState<PendingReply[]>([]);

  const sendReply = useMutation({
    // The key is minted by the caller now, not in here: the optimistic bubble
    // has to carry the same one to be matched against the row that comes back.
    mutationFn: ({ body, attachmentUrls, clientMessageId }: PendingReply) =>
      api.post(API_ROUTES.ADMIN.CONVERSATION_MESSAGES(activeId!), {
        body,
        attachmentUrls,
        clientMessageId,
      }),
    onMutate: (vars) => { setPending((prev) => [...prev, vars]); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.thread(activeId) });
      refetchLists();
    },
    onError: (e: Error, vars) => {
      // The bubble goes; drawing early must not leave the seller believing a
      // failed reply was sent.
      setPending((prev) => prev.filter((x) => x.clientMessageId !== vars.clientMessageId));
      dialog.alert(e.message);
    },
  });

  /** Drop optimistic bubbles once the real row is on screen. Returning the
   *  previous array unchanged when there is nothing to drop stops this looping
   *  on its own output. */
  const confirmedKeys = useMemo(
    () => new Set(threadMessages.map((m) => m.clientMessageId).filter(Boolean) as string[]),
    [threadMessages],
  );
  useEffect(() => {
    setPending((prev) => {
      const next = prev.filter((x) => !confirmedKeys.has(x.clientMessageId));
      return next.length === prev.length ? prev : next;
    });
  }, [confirmedKeys]);

  /**
   * Uploaded before the message that carries them, against the conversation
   * rather than an order — the inbox has threads that belong to no order at
   * all, and the order panel's endpoint could not serve them.
   */
  const uploadAttachments = async (files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    return api.post<{ name: string; url: string }[]>(
      API_ROUTES.ADMIN.CONVERSATION_ATTACHMENTS(activeId!),
      form,
    );
  };

  const deleteMessage = useMutation({
    mutationFn: (messageId: string) => api.delete(API_ROUTES.ADMIN.MESSAGE_DELETE(messageId)),
    // No optimistic update: unsending is irreversible and the buyer sees it
    // too, so the thread should show what the server actually accepted rather
    // than what was asked for.
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.thread(activeId) }); refetchLists(); },
    onError: (e: Error) => dialog.alert(e.message),
  });

  const saveNote = useMutation({
    mutationFn: (body: string) =>
      api.put(API_ROUTES.ADMIN.CONVERSATION_BUYER_NOTE(activeId!), { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.buyer(activeId) }),
    onError:   (e: Error) => dialog.alert(e.message),
  });

  const setLabels = useMutation({
    mutationFn: (labelIds: string[]) =>
      api.put(API_ROUTES.ADMIN.CONVERSATION_LABELS(activeId!), { labelIds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: QK.thread(activeId) }); refetchLists(); },
    onError:   (e: Error) => dialog.alert(e.message),
  });

  const createLabel = useMutation({
    mutationFn: (name: string) => api.post(API_ROUTES.ADMIN.MESSAGE_LABELS, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['message-labels'] }),
    onError:   (e: Error) => dialog.alert(e.message),
  });

  const saveAutoReply = useMutation({
    mutationFn: ({ message, activeUntil }: { message: string; activeUntil: string | null }) =>
      api.put(API_ROUTES.ADMIN.MESSAGE_AUTO_REPLY, { message, activeUntil, enabled: activeUntil !== null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['message-auto-reply'] }),
    onError:   (e: Error) => dialog.alert(e.message),
  });

  const rows    = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);

  /**
   * Restore appears whenever something filed is selected, not only inside
   * Trash and Spam.
   *
   * Archived threads have no folder of their own — the reference offers
   * Archive as an action, not a place — so they surface under All. Gating
   * Restore on the folder meant archiving was a one-way trip: the thread was
   * visible in All with no way to bring it back.
   */
  const anyFiledSelected = useMemo(
    () => rows.some((r) => selected.has(r.id) && ['ARCHIVED', 'TRASHED', 'SPAM'].includes(r.status)),
    [rows, selected],
  );
  const counts  = foldersQuery.data;
  const allLabels = labelsQuery.data ?? [];
  const thread  = threadQuery.data ?? null;
  const total   = listQuery.data?.meta.totalPages ?? 1;

  // ── Realtime ───────────────────────────────────────────────────────────
  // Invalidate rather than append the pushed message: the row the socket
  // carries is the raw record, while the thread query returns it shaped for
  // this screen. Splicing the two together is how the list ends up holding
  // two subtly different kinds of message. One extra fetch on a message that
  // has already arrived is cheap.
  useConversationStream(activeId, (incoming) => {
    // Merged straight from the packet, as the storefront already did. This
    // used to refetch instead, because the gateway pushed the raw row and this
    // view's ThreadMessage needs a flattened attachedProduct — so every
    // message either side sent cost a full thread fetch before it could be
    // drawn, and the seller's optimistic bubble sat there through it. The
    // gateway now sends the flattened shape.
    if (incoming) merge([incoming as unknown as ThreadMessage]);
    // Still invalidated: a read receipt or an unsend arrives with no message,
    // and a socket that never connected has to be caught by something.
    qc.invalidateQueries({ queryKey: QK.thread(activeId) });
    refetchLists();
  });

  // Guests have no account and so no presence; only a signed-in buyer can be
  // online in any meaningful sense.
  const buyerUserId = thread?.user?.id ?? null;
  const presence    = usePresence(buyerUserId ? [buyerUserId] : []);
  const buyerPresence = buyerUserId ? presence.get(buyerUserId) : undefined;

  /**
   * Reaching the newest message marks the thread read.
   *
   * This used to fire on open, which said the seller had seen a message the
   * instant they clicked the row — even if they went straight up into history,
   * and even for messages that arrived while they were reading further back.
   *
   * ThreadView reports every scroll that ends at the foot, so the guard is
   * here: one request per (thread, newest message) and no more. Without it a
   * reader resting at the bottom would post a read on every scroll event.
   */
  const lastRead = useRef<string | null>(null);

  const markSeen = useCallback(() => {
    if (!activeId) return;
    const newest = threadMessages[threadMessages.length - 1]?.id ?? '';
    const key    = `${activeId}:${newest}`;
    if (lastRead.current === key) return;
    lastRead.current = key;

    api.post(API_ROUTES.ADMIN.CONVERSATION_READ(activeId), {})
      .then(() => refetchLists())
      // Cleared on failure so the next scroll to the foot tries again rather
      // than leaving the thread unread for good.
      .catch(() => { lastRead.current = null; });
    // refetchLists is recreated every render and depending on it would rebuild
    // this callback each time, which re-runs the listener effect in ThreadView.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, threadMessages]);

  const toggleSelect = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const act = (action: BulkAction) => {
    if (!selected.size) return;
    bulk.mutate({ ids: [...selected], action });
  };

  const addLabel = async () => {
    const name = await dialog.prompt('Name the new label', { title: 'New label', placeholder: 'Custom order' });
    if (name?.trim()) createLabel.mutate(name.trim());
  };

  if (!isReady) return <div className="p-8 text-sm text-muted">Loading…</div>;

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  // h-full, not a dvh calculation: <main> is flex-1 inside an h-screen
  // column, so its content box is already exactly the room this page has —
  // measured rather than guessed. The old calc() guessed twice and missed
  // twice: it subtracted 4rem for a mobile bar that is h-14 (3.5rem), and it
  // did not know <main> has padding of its own, so the box came out ~40px
  // taller than the space it was given and the page scrolled.
  //
  // No padding here either, for the same reason: <main> already applies it,
  // and adding p-4 on top made 32px of gutter on each side of a 390px phone.
  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <AdminPageHeader title="Messages" />
        <div className="flex items-center gap-3">
          <label className="relative w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <span className="sr-only">Search your messages</span>
            <input
              value={search}
              onChange={(e) => changeView(() => setSearch(e.target.value))}
              placeholder="Search your messages"
              className="w-full rounded-full border border-border bg-surface py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>

          {canWriteShopData && autoReplyQuery.data && (
            <AutoReplyMenu
              value={autoReplyQuery.data}
              saving={saveAutoReply.isPending}
              onSave={async (message, activeUntil) => { await saveAutoReply.mutateAsync({ message, activeUntil }); }}
            />
          )}
        </div>
      </div>

      {/* Stacked on a phone, side by side from md. Unconditionally a row,
          the 224px folder rail and its gap took 244px of a 342px content
          width and left the message list about 98px wide. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row md:gap-5">
        {/* ── Folders ──────────────────────────────────────────────────── */}
        {/* A horizontal strip on a phone: ten folders down the side of a
            small screen is most of the screen. shrink-0 on the nav itself
            only from md, or the strip refuses to compress and pushes the
            list off the edge. */}
        <nav
          className="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 pb-1 md:mx-0 md:w-56 md:flex-col md:gap-0 md:space-y-0.5 md:overflow-visible md:px-0 md:pb-0"
          aria-label="Mail folders"
        >
          {FOLDERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => changeView(() => { setFolder(f); setActiveId(null); })}
              aria-current={folder === f ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-button px-3 py-2 text-left text-sm md:w-full md:shrink md:justify-between md:gap-0 ${
                folder === f ? 'bg-background font-semibold text-secondary' : 'text-muted hover:bg-background/60'
              }`}
            >
              {FOLDER_LABELS[f]}
              {counts && counts[f] > 0 && <span className="text-xs">{counts[f]}</span>}
            </button>
          ))}
        </nav>

        {/* ── List ─────────────────────────────────────────────────────────
            Replaced by the thread rather than squeezed beside it.

            Three columns at once never fitted: the list, the conversation and
            the buyer panel were each given a share of what is left after the
            folders, and every one of them ended up too narrow — the list's
            toolbar wrapped onto three lines, its rows printed the name on top
            of the timestamp, and the thread's own toolbar ran under the buyer
            panel. Capping widths only moved which column paid.

            Reading a thread and scanning the list are different tasks, so the
            screen shows one at a time and each gets the whole width. Returning
            is the X in the thread's toolbar, or any folder on the left. */}
        {!activeId && (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
              aria-label="Select all conversations on this page"
              className="mr-2 h-4 w-4 rounded border-border"
            />
            <ToolbarButton icon={Trash2}     label="Trash"       onClick={() => act('trash')}   disabled={!selected.size} />
            <ToolbarButton icon={Mail}       label="Mark unread" onClick={() => act('unread')}  disabled={!selected.size} />
            <ToolbarButton icon={MailOpen}   label="Mark read"   onClick={() => act('read')}    disabled={!selected.size} />
            <ToolbarButton icon={ShieldAlert} label="Spam"       onClick={() => act('spam')}    disabled={!selected.size} />
            <ToolbarButton icon={Archive}    label="Archive"     onClick={() => act('archive')} disabled={!selected.size} />
            {anyFiledSelected && (
              <ToolbarButton icon={Undo2} label="Restore" onClick={() => act('restore')} disabled={!selected.size} />
            )}

            {canWriteShopData && (
              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => setLabelMenuOpen((v) => !v)}
                  aria-expanded={labelMenuOpen}
                  className="flex items-center gap-1.5 rounded-button px-2.5 py-1.5 text-sm text-muted hover:bg-background hover:text-secondary"
                >
                  <Tag className="h-4 w-4" aria-hidden="true" /> Labels
                </button>
                {labelMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setLabelMenuOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-card border border-border bg-surface py-2 shadow-lg">
                      {allLabels.length === 0 && <p className="px-4 py-2 text-xs text-muted">No labels yet.</p>}
                      {allLabels.map((l) => (
                        <span key={l.id} className="flex items-center justify-between px-4 py-1.5 text-sm">
                          <span className={`rounded px-2 py-0.5 text-xs ${LABEL_CHIP[l.color]}`}>{l.name}</span>
                          <span className="text-xs text-muted">{l._count?.links ?? 0}</span>
                        </span>
                      ))}
                      <div className="my-1 border-t border-border" />
                      <button
                        type="button"
                        onClick={() => { setLabelMenuOpen(false); void addLabel(); }}
                        className="w-full px-4 py-2 text-left text-sm text-primary hover:bg-background"
                      >
                        New label
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {listQuery.isLoading ? (
              <p className="flex items-center gap-2 px-5 py-16 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
              </p>
            ) : listQuery.isError ? (
              <p className="px-5 py-16 text-sm text-error">{(listQuery.error as Error).message}</p>
            ) : (
              <ConversationList
                rows={rows}
                selected={selected}
                activeId={activeId}
                // Never compact any more: the list is only on screen when it
                // has the full width, so hiding the message preview to save
                // room would be throwing away the column that makes the list
                // worth scanning.
                onSelect={toggleSelect}
                onOpen={setActiveId}
                onToggleStar={(row) => toggleStar.mutate({ id: row.id, starred: row.isStarred })}
              />
            )}
          </div>

          {total > 1 && (
            <div className="flex items-center justify-center gap-4 border-t border-border py-3 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => { setPage(page - 1); setSelected(new Set()); }} className="rounded-full border border-border px-4 py-1.5 disabled:opacity-50">Previous</button>
              <span className="text-muted">Page {page} of {total}</span>
              <button type="button" disabled={page >= total} onClick={() => { setPage(page + 1); setSelected(new Set()); }} className="rounded-full border border-border px-4 py-1.5 disabled:opacity-50">Next</button>
            </div>
          )}
        </section>
        )}

        {/* ── Thread + buyer ─────────────────────────────────────────────
            Takes the width the list gave up, so no fixed size is needed: it
            was 42rem with shrink-0, which is what starved the list beside it. */}
        {activeId && (
          <section className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-card border border-border bg-surface">
            {threadQuery.isLoading || !thread ? (
              <p className="flex items-center gap-2 p-6 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading conversation…
              </p>
            ) : (
              <>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-1 border-b border-border px-4 py-2">
                    <button
                      type="button"
                      onClick={() => toggleStar.mutate({ id: thread.id, starred: thread.isStarred })}
                      aria-pressed={thread.isStarred}
                      aria-label={thread.isStarred ? 'Unstar conversation' : 'Star conversation'}
                      className="p-1.5 text-muted hover:text-warning"
                    >
                      <Star className={`h-4 w-4 ${thread.isStarred ? 'fill-warning text-warning' : ''}`} aria-hidden="true" />
                    </button>
                    <ToolbarButton icon={Trash2}      label="Trash"   onClick={() => { bulk.mutate({ ids: [thread.id], action: 'trash' }); setActiveId(null); }} />
                    <ToolbarButton icon={Mail}        label="Unread"  onClick={() => { bulk.mutate({ ids: [thread.id], action: 'unread' }); setActiveId(null); }} />
                    <ToolbarButton icon={ShieldAlert} label="Spam"    onClick={() => { bulk.mutate({ ids: [thread.id], action: 'spam' }); setActiveId(null); }} />
                    <ToolbarButton icon={Archive}     label="Archive" onClick={() => { bulk.mutate({ ids: [thread.id], action: 'archive' }); setActiveId(null); }} />
                    <button
                      type="button"
                      onClick={() => setActiveId(null)}
                      aria-label="Close conversation"
                      className="ml-auto p-1.5 text-muted hover:text-secondary"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <ThreadView
                    onSeenLatest={markSeen}
                    pending={pending}
                    conversation={thread}
                    messages={threadMessages}
                    hasMoreOlder={cursor?.hasMore ?? false}
                    loadingOlder={loadingOlder}
                    onLoadOlder={loadOlder}
                    sending={sendReply.isPending}
                    onSend={async (body, attachmentUrls) => {
                      // Minted here so the optimistic bubble and the request
                      // carry the same key, and a retry of this press still
                      // lands once.
                      await sendReply.mutateAsync({
                        body, attachmentUrls, clientMessageId: newClientMessageId(),
                      });
                    }}
                    onUpload={uploadAttachments}
                    // Only where this viewer may write to the shop. A
                    // platform-context SUPER_ADMIN is reading someone else's
                    // inbox for support, and the server would refuse anyway —
                    // offering the control would just produce an error.
                    onDeleteMessage={canWriteShopData ? (id) => {
                      void dialog
                        .confirm(
                          'Unsend this message? The buyer will see that a message was unsent.',
                          { destructive: true },
                        )
                        .then((ok) => { if (ok) deleteMessage.mutate(id); });
                    } : undefined}
                  />
                </div>

                {canWriteShopData && (
                  <BuyerPanel
                    buyer={buyerQuery.data ?? null}
                    presence={presenceLabel(buyerPresence)}
                    online={buyerPresence?.online ?? false}
                    labels={thread.labels}
                    allLabels={allLabels}
                    savingNote={saveNote.isPending}
                    onSaveNote={async (body) => { await saveNote.mutateAsync(body); }}
                    onToggleLabel={(labelId) => {
                      const has  = thread.labels.some((l) => l.id === labelId);
                      const next = has
                        ? thread.labels.filter((l) => l.id !== labelId).map((l) => l.id)
                        : [...thread.labels.map((l) => l.id), labelId];
                      setLabels.mutate(next);
                    }}
                  />
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon, label, onClick, disabled,
}: { icon: typeof Trash2; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="flex items-center gap-1.5 rounded-button px-2.5 py-1.5 text-sm text-muted hover:bg-background hover:text-secondary disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}
