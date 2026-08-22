'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children into document.body, escaping every ancestor.
 *
 * For overlays that cover the viewport — the cart drawer, the mobile nav — and
 * therefore must not inherit a containing block from anything above them.
 *
 * The specific trap this exists for: an ancestor with a `transform` becomes the
 * containing block for `position: fixed` descendants. StickyHeader animates the
 * header with a transform, so once these drawers sat inside it their `fixed`
 * stopped meaning "the viewport" and started meaning "the ~112px header box".
 * A closed drawer parked at `translate-x-full` then sat outside that box and
 * widened the document, which is a horizontal scrollbar on every page.
 *
 * Nothing about that is visible in the drawer's own CSS, which is what makes it
 * worth a component and a comment rather than a one-line fix somewhere.
 *
 * The mounted flag is for SSR: `document` does not exist during the server
 * render, and a portal that runs there throws. Rendering null on the first pass
 * costs nothing, since an overlay is closed on load anyway.
 */
export function ViewportPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
