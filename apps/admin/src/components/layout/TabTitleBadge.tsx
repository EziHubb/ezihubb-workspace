'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useInboxNotifications } from '../../lib/realtime';

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
 * The badge geometry, as fractions of the canvas so it survives a size change.
 *
 * DOT_INSET is the one that is not a taste decision. The logo is a SQUARE and
 * the icon file is opaque corner to corner — measured, not assumed — so a dot
 * centred exactly on the corner puts only one of its four quadrants over the
 * artwork: 25% in, 75% hanging in space. Pulling the centre back along the
 * diagonal by this much is what makes it a true half, solved numerically
 * rather than eyeballed.
 *
 * The four are not independent. The furthest the ring reaches is
 * LOGO_SCALE - DOT_INSET + DOT_RADIUS + RING_WIDTH, which must stay <= 1 or
 * the canvas edge clips it. As set here that is exactly 1.000.
 */
const LOGO_SCALE = 0.870;
const DOT_RADIUS = 0.150;
const RING_WIDTH = 0.031;
const DOT_INSET  = 0.051;

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

    // The logo is drawn SMALLER than the canvas, and this is the whole trick.
    // A dot that hangs off the corner needs somewhere to hang into, and a
    // canvas has no outside — anything past its edge is simply cut off. The
    // margin left here is that outside.
    const logo = size * LOGO_SCALE;
    ctx.drawImage(img, 0, 0, logo, logo);

    // Straddling the logo's bottom-right corner: half the dot over the
    // artwork, half over the margin. Sitting fully inside, it read as a hole
    // punched in the logo rather than a badge attached to it.
    const cx = logo - size * DOT_INSET;
    const cy = logo - size * DOT_INSET;
    const r  = size * DOT_RADIUS;
    const ring = size * RING_WIDTH;

    // A white ring under the dot, for two reasons now. It separates red from
    // a logo that is itself coloured — the two blur into one shape at the
    // size this is really seen — and it is what makes the badge read as
    // sitting ON TOP of the icon rather than being part of it.
    ctx.beginPath();
    ctx.arc(cx, cy, r + ring, 0, Math.PI * 2);
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
 * And shown ONLY while the seller is somewhere else — another tab, another
 * window, another application. That is the whole point of writing into the
 * tab: it is the one surface still visible after they have left. While they
 * are here the page already has a toast, a sidebar badge and the inbox
 * itself, and a fourth copy in a tab they are looking at is noise. Coming
 * back clears it.
 *
 * Renders nothing. It exists to own document.title, the tab icon, and one
 * socket listener.
 */
export function TabTitleBadge() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  /**
   * Whether the seller is somewhere else right now.
   *
   * Read at event time rather than captured in the handler's closure:
   * useInboxNotifications holds the callback in a ref and never re-registers
   * it, so a value closed over here would be frozen at whatever it was when
   * the socket effect last ran.
   */
  const away = useRef(false);

  useEffect(() => {
    const sync = () => {
      // "Away" is not just a hidden tab. A tab can be the foreground tab of a
      // window that is itself behind another app — Chrome still reports that
      // as visible, and the seller reading email over the top of it is very
      // much not looking at this. hasFocus() is what catches the second case.
      const isAway = document.visibilityState === 'hidden' || !document.hasFocus();
      away.current = isAway;
      // Back on this tab: whatever the badge was for has been seen, in the
      // tab strip if nowhere else. The unread total lives in the sidebar.
      if (!isAway) setCount(0);
    };

    sync();
    document.addEventListener('visibilitychange', sync);
    // focus/blur, not visibilitychange alone: switching to another APPLICATION
    // fires only these, and that is the case the seller asked for.
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
    };
  }, []);

  useInboxNotifications(() => {
    // The only gate now. It subsumes the two this used to have: being on the
    // inbox, and having that very thread open, both mean the seller is HERE —
    // and if they are here the badge is not for them. Being away makes both
    // questions moot, since nothing on the page is visible either way.
    if (!away.current) return;
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
