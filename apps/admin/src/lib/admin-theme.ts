export interface AdminTheme {
  key:          string;
  name:         string;
  /** RGB channels with spaces: "R G B" — for use in rgb(var(--c-primary) / alpha) */
  primaryRgb:   string;
  primaryDark:  string;
  primaryLight: string;
  sidebar:      string;
}

export const ADMIN_THEMES: AdminTheme[] = [
  {
    key:          'coral',
    name:         'Coral',
    primaryRgb:   '232 93 63',
    primaryDark:  '#C44A2E',
    primaryLight: '#FFF0EC',
    sidebar:      '#1E1E2E',
  },
  {
    key:          'ocean',
    name:         'Ocean',
    primaryRgb:   '14 165 233',
    primaryDark:  '#0284C7',
    primaryLight: '#E0F2FE',
    sidebar:      '#0C2340',
  },
  {
    key:          'forest',
    name:         'Forest',
    primaryRgb:   '22 163 74',
    primaryDark:  '#15803D',
    primaryLight: '#DCFCE7',
    sidebar:      '#0F2D1A',
  },
  {
    key:          'violet',
    name:         'Violet',
    primaryRgb:   '124 58 237',
    primaryDark:  '#6D28D9',
    primaryLight: '#EDE9FE',
    sidebar:      '#1C1033',
  },
  {
    key:          'rose',
    name:         'Rose',
    primaryRgb:   '225 29 72',
    primaryDark:  '#BE123C',
    primaryLight: '#FFE4E6',
    sidebar:      '#2D0A18',
  },
  {
    key:          'slate',
    name:         'Slate',
    primaryRgb:   '99 102 241',
    primaryDark:  '#4F46E5',
    primaryLight: '#EEF2FF',
    sidebar:      '#0F172A',
  },
];

export const DEFAULT_THEME = ADMIN_THEMES[0];
export const STORAGE_KEY   = 'admin-theme';

export function applyTheme(theme: AdminTheme) {
  const r = document.documentElement;
  r.style.setProperty('--c-primary',       theme.primaryRgb);
  r.style.setProperty('--c-primary-dark',  theme.primaryDark);
  r.style.setProperty('--c-primary-light', theme.primaryLight);
  r.style.setProperty('--c-sidebar',       theme.sidebar);
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
