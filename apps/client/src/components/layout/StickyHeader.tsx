'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * How far the top of the viewport is from the first usable pixel of content.
 *
 * Anything sticky further down the page reads this instead of hard-coding a
 * number: the search filter bar, the filter sidebar, the mobile filter row.
 * They all used `top-16` (64px) against a header that is really 112px on
 * desktop, so each of them sat 48px behind it — and once the header could
 * disappear they were left floating with the grid scrolling above them.
 */
const HEADER_OFFSET_VAR = '--header-offset';

/**
 * Sticky header that gets out of the way when you scroll down and comes back
 * the moment you scroll up.
 *
 * The header is ~112px of a ~900px viewport. On a product page that is the
 * difference between seeing the gallery and the buy panel together or not, and
 * the header earns none of it while somebody is reading down the page.
 *
 * Hiding is by transform, not by unmounting or switching position. The element
 * stays sticky and keeps its box, so nothing below it reflows as it goes — an
 * unmount would make the whole page jump up by the header's height mid-scroll.
 */
export function StickyHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const [animate, setAnimate] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  // Publish the header's real height, or 0 while it is hidden, so sticky
  // elements below can offset by what is actually there rather than by a
  // constant that was wrong on desktop and wronger once this started hiding.
  //
  // A ResizeObserver rather than a one-off measurement: the header grows and
  // shrinks with the campaign banner and at the mobile breakpoint.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    const publish = () => {
      const h = hidden ? 0 : el.getBoundingClientRect().height;
      document.documentElement.style.setProperty(HEADER_OFFSET_VAR, `${Math.round(h)}px`);
    };

    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hidden]);

  useEffect(() => {
    // A reduced-motion reader still wants the space back; they just do not want
    // to watch it slide. Behaviour stays, the transition goes.
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setAnimate(!mq.matches);
    const onPref = (e: MediaQueryListEvent) => setAnimate(!e.matches);
    mq.addEventListener('change', onPref);

    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;

      // Ignore sub-pixel and rubber-band jitter. Without this, a trackpad's
      // tiny oscillations flip the header back and forth while the page is
      // effectively still.
      if (Math.abs(delta) < 4) return;

      // Never hidden right at the top, so the first flick of the wheel does not
      // take the navigation away before the reader has scrolled past anything.
      //
      // 60, not 120: on a product page the gallery starts within the first
      // screenful, so waiting for 120px meant the header was still there at the
      // exact moment its space was needed most.
      if (y < 60) {
        setHidden(false);
      } else {
        setHidden(delta > 0);
      }

      lastY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      mq.removeEventListener('change', onPref);
    };
  }, []);

  return (
    <div
      ref={boxRef}
      className={[
        'sticky top-0 z-50',
        animate ? 'transition-transform duration-300 ease-out' : '',
        hidden ? '-translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      {children}
    </div>
  );
}
