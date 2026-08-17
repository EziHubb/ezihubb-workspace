export interface AdminTheme {
  key:          string;
  name:         string;
  /** RGB channels with spaces: "R G B" — for use in rgb(var(--c-primary) / alpha) */
  primaryRgb:   string;
  primaryDark:  string;
  primaryLight: string;
}

// The sidebar itself is always Etsy's cream (`bg-background`) regardless of
// theme — only the accent color used for buttons, links, and the active-nav
// tint (`sidebar-active`, see apps/admin/tailwind.config.js) varies per theme.
export const ADMIN_THEMES: AdminTheme[] = [
  {
    key:          'coral',
    name:         'Coral',
    primaryRgb:   '232 93 63',
    primaryDark:  '#C44A2E',
    primaryLight: '#FFF0EC',
  },
  {
    key:          'classic',
    name:         'Classic',
    primaryRgb:   '26 26 26',
    primaryDark:  '#000000',
    primaryLight: '#F2F2F2',
  },
  {
    key:          'ocean',
    name:         'Ocean',
    primaryRgb:   '14 165 233',
    primaryDark:  '#0284C7',
    primaryLight: '#E0F2FE',
  },
  {
    key:          'forest',
    name:         'Forest',
    primaryRgb:   '22 163 74',
    primaryDark:  '#15803D',
    primaryLight: '#DCFCE7',
  },
  {
    key:          'violet',
    name:         'Violet',
    primaryRgb:   '124 58 237',
    primaryDark:  '#6D28D9',
    primaryLight: '#EDE9FE',
  },
  {
    key:          'rose',
    name:         'Rose',
    primaryRgb:   '225 29 72',
    primaryDark:  '#BE123C',
    primaryLight: '#FFE4E6',
  },
  {
    key:          'slate',
    name:         'Slate',
    primaryRgb:   '99 102 241',
    primaryDark:  '#4F46E5',
    primaryLight: '#EEF2FF',
  },
];

export const DEFAULT_THEME = ADMIN_THEMES[0];
export const STORAGE_KEY   = 'admin-theme';

export function applyTheme(theme: AdminTheme) {
  const r = document.documentElement;
  r.style.setProperty('--c-primary',       theme.primaryRgb);
  r.style.setProperty('--c-primary-dark',  theme.primaryDark);
  r.style.setProperty('--c-primary-light', theme.primaryLight);
}

export function loadSavedTheme(): AdminTheme {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  const key = localStorage.getItem(STORAGE_KEY);
  return ADMIN_THEMES.find((t) => t.key === key) ?? DEFAULT_THEME;
}

export function saveTheme(theme: AdminTheme) {
  localStorage.setItem(STORAGE_KEY, theme.key);
  applyTheme(theme);
}
