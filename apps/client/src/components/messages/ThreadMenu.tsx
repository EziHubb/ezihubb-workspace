'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useAuthStore } from '../../lib/store/auth.store';
import { toast } from '../../lib/store/toast.store';

/**
 * What a buyer can do to a whole conversation: report it, or take it off
 * their list.
 *
 * This replaced the order number that used to sit here. The number named one
 * order on a thread that now spans every order the buyer has with the shop, so
 * it was answering a question nobody asked while the two things a person
 * actually wants from a thread had nowhere to live.
 */

const REASONS = ['SPAM', 'HARASSMENT', 'SCAM', 'OFF_PLATFORM', 'INAPPROPRIATE', 'OTHER'] as const;
type Reason = (typeof REASONS)[number];

export function ThreadMenu({ conversationId, onHidden }: {
  conversationId: string;
  /** Called once the thread is gone, so the page can clear the open thread. */
  onHidden: () => void;
}) {
  const t = useTranslations('account.messages');
  const token = useAuthStore((s) => s.accessToken);

  const [open, setOpen]       = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason]   = useState<Reason>('SPAM');
  const [note, setNote]       = useState('');
  const [busy, setBusy]       = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  /**
   * Closes on an outside click and on Escape.
   *
   * Bound while open only — a listener that stays attached runs on every click
   * anywhere in the app for a menu that is not on screen.
   */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hide = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiClient.delete(API_ROUTES.MESSAGES.CONVERSATION_HIDE(conversationId), {
        token: token ?? undefined,
      });
      setOpen(false);
      onHidden();
      toast.success(t('conversationRemoved'));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiClient.post(
        API_ROUTES.MESSAGES.CONVERSATION_REPORT(conversationId),
        { reason, note: note.trim() || undefined },
        { token: token ?? undefined },
      );
      setReporting(false);
      setOpen(false);
      setNote('');
      toast.success(t('reportSent'));
    } catch (e) {
      // The API refuses a second open report from the same person; that is a
      // sentence worth showing rather than swallowing.
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('threadActions')}
        className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-background hover:text-secondary"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && !reporting && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => setReporting(true)}
            className="block w-full px-4 py-2 text-left text-sm text-secondary hover:bg-background"
          >
            {t('reportConversation')}
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={hide}
            className="block w-full px-4 py-2 text-left text-sm text-error hover:bg-background disabled:opacity-50"
          >
            {t('deleteConversation')}
          </button>
        </div>
      )}

      {open && reporting && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium text-secondary">{t('reportConversation')}</p>

          <label className="sr-only" htmlFor="report-reason">{t('reportReason')}</label>
          <select
            id="report-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as Reason)}
            className="mb-2 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>{t(`reportReasons.${r}`)}</option>
            ))}
          </select>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={t('reportNotePlaceholder')}
            className="w-full resize-none rounded-lg border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="px-3 py-1.5 text-xs text-muted hover:text-secondary"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submitReport}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? t('sending') : t('sendReport')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
