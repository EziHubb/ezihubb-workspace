'use client';

import { useEffect, useRef, useState } from 'react';

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
      if (Math.abs(delta) < 6) return;

      // Never hidden near the top. Otherwise the first flick of the wheel
      // takes the header away before the reader has scrolled past anything,
      // which reads as the page eating its own navigation.
      if (y < 120) {
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
