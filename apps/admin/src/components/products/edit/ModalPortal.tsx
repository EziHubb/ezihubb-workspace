'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a modal into document.body, out of every ancestor.
 *
 * The variation modals live deep inside the listing editor: a scroll region,
 * a sticky tab nav with its own stacking context, and the admin layout's
 * `overflow-hidden` shell above that. A `fixed inset-0` backdrop rendered down
 * there is at the mercy of all of it — one ancestor with a transform, a filter,
 * or a competing z-index is enough to leave a strip of the page undimmed and
 * clickable, which is exactly what happened along the top of the editor.
 *
 * Raising z-index would be guessing at which ancestor is responsible and would
 * break again the next time one is added. Portalling to body removes the
 * question: there are no ancestors left to interfere.
 *
 * The mounted flag is for SSR — `document` does not exist during the server
 * render, and a portal that runs there throws. Rendering null on the first
 * pass costs nothing, since a modal starts closed anyway.
 */
export function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
