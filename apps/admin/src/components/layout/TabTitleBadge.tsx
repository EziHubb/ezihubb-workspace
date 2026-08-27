'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useInboxNotifications, isConversationOpen } from '../../lib/realtime';

/**
 * Our own prefix. Matched so every run can strip it before writing a fresh
 * one, which is what keeps the count from accreting as "(1) (2) (3) …".
 */
const BADGE = /^\(\d+\+?\)\s+/;

/** Past this the exact figure stops being information. */
const MAX_SHOWN = 99;

/** The id on the <link> this component owns, so it can find its own again. */
const FAVICON_ID = 'ezihubb-tab-badge-icon';

/**
 * The 192px icon, not favicon-32: it is drawn down to 64 rather than up, so
 * the result is sharp instead of a blurred 32.
 */
const ICON_SRC = '/android-chrome-192x192.png';

/** `error` from libs/ui's theme — the same red the app uses everywhere else. */
const DOT = '#DC2626';

/**
 * The app icon with a red dot on it.
 *
 * A dot rather than the number: at the 16px a tab actually renders, a digit
 * in a corner is three or four pixels tall and reads as noise. The count is
 * already in the title beside it, which is where it can be read.
 *
 * Returns null rather than throwing if anything is unavailable — a tab icon
 * is decoration, and losing it must never take the title badge with it.
 */
async function drawBadgedIcon(): Promise<string | null> {
  try {
    const img = new Image();
    img.src = ICON_SRC;
    // decode() rather than an onload/onerror pair: it rejects on failure, so
    // the catch below covers a missing file as well as a blocked canvas.
    await img.decode();

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, size, size);

    const r  = size * 0.26;
    const cx = size - r - 3;
    const cy = r + 3;

    // A white ring under the dot. Without it the red sits directly on the
    // logo, which is itself coloured, and the two blur into one shape at the
    // size this is actually seen.
    ctx.beginPath();
    ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = DOT;
    ctx.fill();

    // Same-origin PNG, so the canvas is not tainted and this cannot throw a
    // SecurityError the way a remote image would.
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * The unread count in the browser tab.
 *
 * Deliberately session-scoped: the number starts at zero on every page load
 * and only ever counts messages that ARRIVED while this tab was open. It is
 * not the seller's unread total — that already has a home, the badge beside
 * "Messages" in the sidebar, which is fetched and survives a reload. Mixing
 * the two would put a permanent number in the tab for a backlog nobody plans
 * to clear today, and a tab that always says "(12)" says nothing at all.
 *
 * Shown twice over: as a count in the title, and as a red dot on the tab
 * icon. The dot is what carries at a glance — a tab strip with eight tabs in
 * it shows favicons at full size and titles clipped to a few characters.
 *
 * Renders nothing. It exists to own document.title, the tab icon, and one
 * socket listener.
 */
export function TabTitleBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  /**
   * Read at event time rather than captured in the handler's closure:
   * useInboxNotifications holds the callback in a ref and never re-registers
   * it, so a value closed over here would be frozen at whatever it was when
   * the socket effect last ran.
   */
  const muted = useRef(false);

  useEffect(() => {
    const onInbox = pathname === '/messages' || pathname.startsWith('/messages/');

    const sync = () => {
      // Sitting on the inbox with the tab in front IS reading them — the list
      // is on screen and the new thread sorts to the top of it. Counting that
      // in the tab would be announcing something already visible, which is
      // how a notification stops being read.
      muted.current = onInbox && document.visibilityState === 'visible';
      if (muted.current) setCount(0);
    };

    sync();
    // Covers the other half: coming back to a backgrounded tab that was
    // already parked on the inbox never changes the pathname, so without this
    // the count from while it was away would stay in the title.
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [pathname]);

  useInboxNotifications((payload) => {
    if (muted.current) return;
    // The same rule the toast uses. Also covers the order panel's composer,
    // which opens a conversation from outside /messages entirely — muted
    // above would not have caught that one.
    if (isConversationOpen(payload.conversationId)) return;
    setCount((n) => n + 1);
  });

  /**
   * The dot on the tab icon.
   *
   * The originals are taken OUT of <head> rather than left beside ours: the
   * root layout declares five rel="icon" links (ico, 16, 32, 192, 512) and
   * nothing defines which of them a browser picks, so adding a sixth is not
   * the same as replacing them. They are kept here and put back verbatim.
   */
  const stashed = useRef<HTMLLinkElement[]>([]);
  const badgedHref = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const restore = () => {
      document.getElementById(FAVICON_ID)?.remove();
      for (const el of stashed.current) document.head.appendChild(el);
      stashed.current = [];
    };

    if (count === 0) { restore(); return; }

    void (async () => {
      // Drawn once and kept: the picture does not depend on the count, so a
      // second message should not repaint a canvas to get the same bytes.
      badgedHref.current ??= await drawBadgedIcon();
      const href = badgedHref.current;
      if (!href || cancelled) return;

      if (stashed.current.length === 0) {
        stashed.current = [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')]
          .filter((el) => el.id !== FAVICON_ID);
        for (const el of stashed.current) el.remove();
      }

      let link = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id   = FAVICON_ID;
        link.rel  = 'icon';
        link.type = 'image/png';
        document.head.appendChild(link);
      }
      link.href = href;
    })();

    return () => { cancelled = true; };
    // pathname included so a navigation that re-asserted the route's own icon
    // links does not quietly win back the tab.
  }, [count, pathname]);

  // Unmount only. Leaving a badged icon behind on the login page, after a
  // sign-out unmounts the admin shell, would show a dot for an inbox nobody
  // can open.
  useEffect(() => () => {
    document.getElementById(FAVICON_ID)?.remove();
    for (const el of stashed.current) document.head.appendChild(el);
    stashed.current = [];
  }, []);

  useEffect(() => {
    // The base title is re-read on every run instead of captured on mount,
    // because routes carry their own metadata title — '/dashboard' sets
    // "Dashboard — EziHubb Admin", an order sets its number. React commits
    // that text into <title> before effects run, so by the time this fires
    // after a navigation it is reading the new route's title, not a stale
    // one. Stripping BADGE first is what makes a run triggered by `count`
    // alone idempotent.
    const base = document.title.replace(BADGE, '');
    const shown = count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count);
    document.title = count > 0 ? `(${shown}) ${base}` : base;
  }, [pathname, count]);

  return null;
}
