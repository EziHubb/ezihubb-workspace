'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/store/auth.store';
import { useInboxNotifications, isConversationOpen } from '../../lib/realtime';
import { toast } from '../../lib/store/toast.store';

/**
 * Tells a signed-in buyer when a shop writes, wherever they are on the site.
 *
 * The seller has had this since the sidebar started listening; the buyer had
 * nothing. A reply landed silently and was found on the next visit to the
 * inbox — which for someone waiting on an answer about their order is the one
 * moment the site should speak up.
 */

function Listener() {
  const qc = useQueryClient();

  useInboxNotifications((payload) => {
    // The list behind the toast is wrong the moment the message lands, so it
    // is refreshed either way — including when no toast is shown.
    qc.invalidateQueries({ queryKey: ['conversations'] });
    qc.invalidateQueries({ queryKey: ['conversation', payload.conversationId] });

    // Not for a thread already on screen. Announcing a message the reader is
    // watching arrive is noise, and noise is how a notification stops being
    // read at all.
    if (!isConversationOpen(payload.conversationId)) {
      toast.info(`${payload.from}: ${payload.preview}`);
    }
  });

  return null;
}

export function InboxToasts() {
  const token = useAuthStore((s) => s.accessToken);

  /**
   * Split in two so the hook below it is never reached without a session.
   *
   * useSocket acquires unconditionally, and this is mounted in the root
   * layout — so calling it here directly would open a websocket for every
   * anonymous visitor to every storefront page, have the gateway refuse the
   * empty token, and leave the retry backoff running for the whole visit.
   */
  if (!token) return null;
  return <Listener />;
}
