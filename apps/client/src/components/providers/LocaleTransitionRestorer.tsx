'use client';

import { useEffect } from 'react';
import { restoreLocaleTransitionState } from '../../lib/locale-transition';

/** Restores the one-shot UI snapshot after a locale RSC remount. */
export function LocaleTransitionRestorer() {
  useEffect(() => restoreLocaleTransitionState(), []);
  return null;
}
