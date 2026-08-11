'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Check } from 'lucide-react';

const LOCALES = [
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
  { code: 'zh', flag: '🇨🇳', label: '中文' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

interface LocaleSwitcherProps {
  /** When true renders as a horizontal row of buttons (for mobile drawer footer) */
  variant?: 'dropdown' | 'inline';
}

export function LocaleSwitcher({ variant = 'dropdown' }: LocaleSwitcherProps) {
  const t        = useTranslations('nav');
  const router   = useRouter();
  const pathname = usePathname();
  const locale   = useLocale() as LocaleCode;
  const [isOpen, setIsOpen] = useState(false);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  const switchLocale = (next: LocaleCode) => {
    if (next === locale) { setIsOpen(false); return; }
    // Pathname includes locale prefix: /en/products/slug → strip it
    const withoutLocale = pathname.replace(new RegExp(`^/${locale}`), '') || '/';
    router.push(`/${next}${withoutLocale}`);
    setIsOpen(false);
  };

  // ── Inline variant (mobile drawer) ───────────────────────────────────────────
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1" role="group" aria-label={t('selectLanguage')}>
        {LOCALES.map((l) => {
          const active = l.code === locale;
          return (
            <button
              key={l.code}
              type="button"
              onClick={() => switchLocale(l.code)}
              aria-pressed={active}
              className={[
                'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted hover:text-secondary hover:bg-muted/8',
              ].join(' ')}
            >
              <span aria-hidden="true">{l.flag}</span>
              <span>{l.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // ── Dropdown variant (desktop navbar) ────────────────────────────────────────
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-label={t('selectLanguage')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors px-2 py-1 rounded-lg hover:bg-muted/10"
      >
        <span aria-hidden="true">{current.flag}</span>
        <span className="hidden xl:inline">{current.label}</span>
        <span className="xl:hidden">{current.code.toUpperCase()}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />

          {/* Dropdown */}
          <div
            role="listbox"
            aria-label={t('selectLanguage')}
            className="absolute right-0 top-full mt-1 w-44 bg-surface rounded-xl shadow-floating border border-border z-50 overflow-hidden py-1"
          >
            {LOCALES.map((l) => {
              const isSelected = l.code === locale;
              return (
                <button
                  key={l.code}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => switchLocale(l.code)}
                  className={[
                    'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left',
                    isSelected
                      ? 'bg-primary/5 font-semibold text-primary'
                      : 'text-secondary hover:bg-muted/5',
                  ].join(' ')}
                >
                  <span className="text-base" aria-hidden="true">{l.flag}</span>
                  <span className="flex-1">{l.label}</span>
                  {isSelected && <Check className="w-3 h-3 text-primary shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
