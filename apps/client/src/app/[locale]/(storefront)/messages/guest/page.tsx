'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { ConversationDto } from '@ezihubb/types';
import { GuestMessageVerification } from '../../../../../components/messages/GuestMessageVerification';
import { MessageThread } from '../../../../../components/messages/MessageThread';
import { useAuthStore } from '../../../../../lib/store/auth.store';

export default function GuestMessagesPage() {
  const locale = useLocale();
  const vi = locale === 'vi';
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [endError, setEndError] = useState(false);
  const [ending, setEnding] = useState(false);
  const session = useQuery({ queryKey: ['guest-message-access'], enabled: !user, retry: false,
    queryFn: () => apiClient.get<{ email: string | null }>(API_ROUTES.MESSAGES.GUEST_ACCESS) });
  const verifiedEmail = session.data?.email;
  const conversations = useQuery({ queryKey: ['guest-conversations', verifiedEmail], enabled: !!verifiedEmail && !user, retry: false,
    queryFn: () => apiClient.get<ConversationDto[]>(API_ROUTES.MESSAGES.GUEST_CONVERSATIONS) });

  return <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 text-secondary">
    <h1 className="font-display text-2xl font-bold">{vi ? 'Hộp thư khách vãng lai' : 'Guest message inbox'}</h1>
    {user ? <p><Link href={`/${locale}/account/messages`} className="text-primary underline">{vi ? 'Mở hộp thư tài khoản của bạn' : 'Open your account inbox'}</Link></p>
      : session.isPending ? <p role="status">{vi ? 'Đang kiểm tra phiên…' : 'Checking your session…'}</p>
        : !verifiedEmail ? <section className="max-w-xl space-y-4">
          <p className="text-sm text-muted">{vi ? 'Xác minh email đã dùng để nhắn tin cho shop. Hội thoại đã liên kết với tài khoản cần đăng nhập để xem.' : 'Verify the email you used to contact the shop. Conversations linked to an account require account sign-in.'}</p>
          <label htmlFor="guest-inbox-email" className="block space-y-2 text-sm font-medium"><span>Email</span>
          <input id="guest-inbox-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-border px-3 py-2 focus-visible:ring-2 focus-visible:ring-primary" />
          </label>
          <GuestMessageVerification email={email} onVerified={(value) => {
            setActiveId(null);
            queryClient.removeQueries({ queryKey: ['conversation'] });
            queryClient.setQueryData(['guest-message-access'], { email: value });
          }} />
        </section> : <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="break-all text-sm">{verifiedEmail}</p>
            <button type="button" disabled={ending} className="min-h-11 rounded-button border border-border px-4 py-2 text-sm disabled:opacity-50" onClick={async () => {
              setEnding(true); setEndError(false);
              try {
                await apiClient.delete(API_ROUTES.MESSAGES.GUEST_ACCESS);
                setActiveId(null);
                queryClient.removeQueries({ queryKey: ['conversation'] });
                queryClient.removeQueries({ queryKey: ['guest-conversations'] });
                queryClient.setQueryData(['guest-message-access'], { email: null });
              } catch { setEndError(true); } finally { setEnding(false); }
            }}>{vi ? 'Kết thúc phiên khách' : 'End guest session'}</button>
          </div>
          {endError && <p role="alert" className="text-error">{vi ? 'Chưa thể kết thúc phiên. Hãy thử lại.' : 'Unable to end this session. Please try again.'}</p>}
          {activeId ? <section className="space-y-3">
            <button type="button" onClick={() => setActiveId(null)} className="min-h-11 rounded-button border border-border px-4 py-2 text-sm focus-visible:ring-2 focus-visible:ring-primary">
              {vi ? 'Quay lại hộp thư' : 'Back to inbox'}
            </button>
            <div className="flex h-[65vh] min-h-96 flex-col overflow-hidden rounded-card border border-border"><MessageThread conversationId={activeId} onBack={() => setActiveId(null)} /></div>
          </section>
            : conversations.isPending ? <p role="status">{vi ? 'Đang tải…' : 'Loading messages…'}</p>
              : conversations.isError ? <p role="alert">{vi ? 'Không thể tải hội thoại. Hãy kết thúc phiên và xác minh lại email.' : 'Unable to load conversations. End this session and verify your email again.'}</p>
                : <ul className="space-y-3">
                  {(conversations.data ?? []).map((conversation) => <li key={conversation.id}>
                    <button type="button" onClick={() => setActiveId(conversation.id)} className="w-full rounded-card border border-border p-4 text-left focus-visible:ring-2 focus-visible:ring-primary">
                      <span className="block font-medium">{conversation.store?.name ?? conversation.subject ?? 'EziHubb'}</span>
                      <span className="block truncate text-sm text-muted">{conversation.lastMessage}</span>
                    </button>
                  </li>)}
                  {!conversations.data?.length && <li className="text-sm text-muted">{vi ? 'Chưa có hội thoại khách nào cho email này.' : 'No guest conversations for this email yet.'}</li>}
                </ul>}
        </>}
  </div>;
}
