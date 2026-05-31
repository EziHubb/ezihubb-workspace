'use client';

import { useState, useEffect } from 'react';

/**
 * Detects when the virtual keyboard is visible on mobile using the
 * visualViewport API. Falls back to false if not supported.
 */
export function useKeyboardVisible(): boolean {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // Keyboard is visible when viewport height shrinks significantly
      setIsKeyboardVisible(vv.height < window.innerHeight * 0.75);
    };

    vv.addEventListener('resize', handleResize);
    // Also check on scroll (iOS can trigger scroll instead of resize)
    vv.addEventListener('scroll', handleResize);

    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  return isKeyboardVisible;
}
