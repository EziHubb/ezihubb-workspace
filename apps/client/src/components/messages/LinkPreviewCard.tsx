'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import type { LinkPreviewDto } from '@ezihubb/types';
import { useAuthStore } from '../../lib/store/auth.store';

/**
 * The card under a message that contains a link.
 *
 * Fetched lazily rather than stored on the message, so a page that had no tags
 * when it was first sent can grow them later, and a link nobody scrolls to is
 * never fetched at all. The server caches the result, so the second reader of
 * a thread costs nothing.
 *
 * It renders nothing at all on failure. A link that cannot be unfurled is a
 * message without a card — never an error in the middle of a conversation.
 */
export function LinkPreviewCard({ conversationId, url }: { conversationId: string; url: string }) {
  const token = useAuthStore((s) => s.accessToken);

  const { data } = useQuery<LinkPreviewDto | null>({
    // The url is in the key: one thread can hold many links and they must not
    // share a cache entry.
    queryKey: ['link-preview', conversationId, url],
    queryFn: () =>
      apiClient.get<LinkPreviewDto | null>(
        `${API_ROUTES.MESSAGES.CONVERSATION_LINK_PREVIEW(conversationId)}?url=${encodeURIComponent(url)}`,
        { token: token ?? undefined },
      ),
    // A preview is decorative. Retrying a link that failed to unfurl spends
    // outbound requests on a thread nobody is waiting on.
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  if (!data) return null;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex max-w-[80%] gap-2.5 overflow-hidden rounded-xl border border-border bg-surface p-2 hover:bg-background"
    >
      {data.image && (
        // Plain img: the host is whatever site was linked, which cannot be
        // known ahead of time and so can never be in next.config's
        // remotePatterns.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0">
        <p className="truncate text-[11px] text-muted">{data.siteName}</p>
        {data.title && <p className="truncate text-xs font-medium text-secondary">{data.title}</p>}
        {data.description && <p className="line-clamp-2 text-[11px] text-muted">{data.description}</p>}
      </div>
    </a>
  );
}
