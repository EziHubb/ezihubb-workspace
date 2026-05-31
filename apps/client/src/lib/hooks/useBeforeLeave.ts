'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * Registers a beforeunload guard when the user has unsaved changes.
 * Also provides a `guardedNavigate` function that intercepts navigation
 * and surfaces a confirm modal before proceeding.
 */
export function useBeforeLeave(isDirty: boolean) {
  const [pendingNavFn, setPendingNavFn] = useState<(() => void) | null>(null);

  // Native browser unload guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /**
   * Wrap any navigation action. If dirty, queues it for confirmation;
   * otherwise executes it immediately.
   */
  const guardedNavigate = useCallback(
    (fn: () => void) => {
      if (!isDirty) {
        fn();
        return;
      }
      // Store as a zero-arg closure so useState doesn't call it as an updater
      setPendingNavFn(() => fn);
    },
    [isDirty],
  );

  const confirmLeave = useCallback(() => {
    if (pendingNavFn) {
      pendingNavFn();
      setPendingNavFn(null);
    }
  }, [pendingNavFn]);

  const cancelLeave = useCallback(() => setPendingNavFn(null), []);

  return {
    guardedNavigate,
    showConfirmModal: pendingNavFn !== null,
    confirmLeave,
    cancelLeave,
  };
}
