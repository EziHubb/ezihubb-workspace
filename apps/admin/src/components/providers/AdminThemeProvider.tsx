'use client';

import { useEffect } from 'react';
import { loadSavedTheme, applyTheme } from '../../lib/admin-theme';

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    applyTheme(loadSavedTheme());
  }, []);

  return <>{children}</>;
}
