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

  // Publish where the header's bottom edge actually is, so sticky elements
  // below can offset by what is on screen rather than by a constant that was
  // wrong on desktop and wronger once this started hiding.
  //
  // The measurement is the visible bottom edge, not the height, and it is
  // sampled every frame while the slide is running. Publishing the final
  // height the moment `hidden` flipped made the offset a step change against a
  // 300ms animation, and the two were plainly out of step: scrolling back up,
  // the filter bar dropped its full height instantly and left a band of bare
  // page at the top for the header to arrive into a third of a second later.
  // Scrolling down it did the reverse and slid up underneath the header.
  //
  // getBoundingClientRect().bottom is exactly "how much room is taken at the
  // top" and, unlike the height, it is correct mid-slide: 0 when parked above
  // the viewport, the full height when in place, and every value between while
  // it moves. The bar below therefore tracks the header frame for frame with
  // no transition of its own to keep in sync.
  //
  // A ResizeObserver too: the header grows and shrinks with the campaign
  // banner and at the mobile breakpoint.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    let raf = 0;
    let last = -1;

    const publish = () => {
      // Never negative: guards the case where a future layout lets the sticky
      // container's own box scroll away.
      const bottom = Math.round(Math.max(0, el.getBoundingClientRect().bottom));
      // Only on a real change — each write invalidates style for every element
      // reading the variable, and most frames of a settled header are identical.
      if (bottom === last) return;
      last = bottom;
      document.documentElement.style.setProperty(HEADER_OFFSET_VAR, `${bottom}px`);
    };

    const follow = () => {
      publish();
      raf = requestAnimationFrame(follow);
    };

    const stopFollowing = (e?: TransitionEvent) => {
      // Only this element's own transform, not a transition bubbling up from
      // something inside the header.
      if (e && (e.target !== el || e.propertyName !== 'transform')) return;
      cancelAnimationFrame(raf);
      raf = 0;
      publish();
    };

    publish();
    raf = requestAnimationFrame(follow);
    // Sampling stops when the slide does. The timeout is the backstop for the
    // cases where no transitionend ever arrives — reduced motion, or a tab
    // backgrounded mid-slide.
    const backstop = setTimeout(() => stopFollowing(), 500);
    el.addEventListener('transitionend', stopFollowing);

    const ro = new ResizeObserver(publish);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(backstop);
      el.removeEventListener('transitionend', stopFollowing);
      ro.disconnect();
    };
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
