'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Search, X, TrendingUp } from 'lucide-react';
import { apiClient, queryKeys } from '@ezihubb/api-client';
import { useDebounce } from '../../lib/hooks/useDebounce';

// ── Fallback popular searches (shown when trending API isn't available) ────────

const FALLBACK_SEARCHES = [
  'custom mug',
  'photo canvas',
  'personalized gift',
  'anniversary',
  'birthday gift',
  'monogram tumbler',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SearchInputProps {
  defaultValue?: string;
  variant?:      'page' | 'navbar' | 'header';
  placeholder?:  string;
  className?:    string;
  onSearch?:     (query: string) => void;
  autoFocus?:    boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchInput({
  defaultValue = '',
  variant      = 'page',
  placeholder,
  className    = '',
  onSearch,
  autoFocus    = false,
}: SearchInputProps) {
  const t        = useTranslations('search');
  const tCommon  = useTranslations('common');
  const id       = useId();
  const listId   = `${id}-listbox`;
  const router   = useRouter();
  const pathname = usePathname();
  const locale   = useLocale();
  const resolvedPlaceholder = placeholder ?? t('inputPlaceholder');

  const [value,     setValue]     = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef   = useRef<HTMLInputElement>(null);
  const routeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce for autocomplete — avoids a query on every keystroke
  const debouncedValue = useDebounce(value, 300);

  // Sync defaultValue on external navigation
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  // ── Autocomplete via React Query ──────────────────────────────────────────
  const { data: suggestions = [] } = useQuery({
    queryKey: queryKeys.autocomplete(debouncedValue),
    queryFn:  () =>
      apiClient
        .get<string[]>('/search/autocomplete', {
          params: { q: debouncedValue },
        }),
    enabled:   debouncedValue.length >= 2,
    staleTime: 60_000,
  });

  // ── Trending keywords (shown in empty dropdown state) ─────────────────────
  const { data: trendingTerms = [] } = useQuery({
    queryKey: queryKeys.trending(),
    queryFn:  () =>
      apiClient
        .get<string[]>('/search/trending'),
    staleTime: 5 * 60_000,
  });

  const popularTerms = trendingTerms.length > 0 ? trendingTerms : FALLBACK_SEARCHES;

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigate = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      const target  = `/${locale}/search${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ''}`;
      router.push(target);
      onSearch?.(trimmed);
    },
    [locale, router, onSearch],
  );

  // ── Handle input change ────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setValue(q);
    setActiveIdx(-1);

    // Update URL live if already on search page (no delay needed — debounce handles it)
    if (routeTimer.current) clearTimeout(routeTimer.current);
    routeTimer.current = setTimeout(() => {
      if (pathname.includes('/search')) {
        const url = new URL(window.location.href);
        if (q.trim()) url.searchParams.set('q', q.trim());
        else          url.searchParams.delete('q');
        router.replace(url.pathname + url.search);
      }
    }, 350);
  };

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const max = suggestions.length - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i >= max ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? max : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = activeIdx >= 0 ? suggestions[activeIdx] : value;
      setValue(selected ?? value);
      setActiveIdx(-1);
      navigate(selected ?? value);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setActiveIdx(-1);
      inputRef.current?.blur();
    }
  };

  const selectSuggestion = (s: string) => {
    setValue(s);
    setActiveIdx(-1);
    navigate(s);
  };

  const clearInput = () => {
    setValue('');
    setActiveIdx(-1);
    if (routeTimer.current) clearTimeout(routeTimer.current);
    inputRef.current?.focus();
    if (pathname.includes('/search')) router.replace(`/${locale}/search`);
  };

  const showDropdown =
    isFocused && (suggestions.length > 0 || value.trim().length === 0);

  // ── Styles by variant ──────────────────────────────────────────────────────
  const isPage   = variant === 'page';
  const isHeader = variant === 'header';
  const inputSize = isPage
    ? 'py-3 text-base pl-12 pr-10'
    : isHeader
      ? 'py-3 pl-5 pr-24 text-sm'
      : 'py-2 text-sm pl-9 pr-8';
  const iconSize = isPage ? 'w-5 h-5 left-4 top-3.5' : 'w-4 h-4 left-2.5 top-2.5';

  return (
    <div className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        {!isHeader && (
          <Search
            className={`absolute ${iconSize} text-muted pointer-events-none`}
            aria-hidden="true"
          />
        )}
        <input
          ref={inputRef}
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showDropdown}
          aria-activedescendant={
            activeIdx >= 0 ? `${listId}-option-${activeIdx}` : undefined
          }
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder={resolvedPlaceholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck="false"
          className={[
            'w-full bg-surface text-secondary transition-colors',
            isHeader
              ? 'border-2 border-border rounded-full focus:outline-none focus:border-primary'
              : 'border border-border rounded-button focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
            '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
            inputSize,
          ].join(' ')}
        />

        {value && (
          <button
            type="button"
            onClick={clearInput}
            aria-label={t('clearSearch')}
            className={
              isHeader
                ? 'absolute right-14 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-secondary transition-colors'
                : 'absolute right-0 top-0 h-full px-2.5 flex items-center text-muted hover:text-secondary transition-colors'
            }
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {isHeader && (
          <button
            type="button"
            onClick={() => { setActiveIdx(-1); navigate(value); inputRef.current?.blur(); }}
            aria-label={tCommon('search')}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary hover:bg-primary-dark rounded-full flex items-center justify-center transition-colors shrink-0"
          >
            <Search className="w-4 h-4 text-white" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          aria-label={t('suggestions')}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-border rounded-card shadow-floating overflow-hidden"
        >
          {suggestions.length > 0 ? (
            // Autocomplete suggestions from API
            <ul>
              {suggestions.map((s, i) => {
                const re    = new RegExp(`(${escapeRegExp(value)})`, 'gi');
                const parts = s.split(re);
                return (
                  <li key={i}>
                    <button
                      id={`${listId}-option-${i}`}
                      role="option"
                      aria-selected={i === activeIdx}
                      type="button"
                      onClick={() => selectSuggestion(s)}
                      className={[
                        'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors',
                        i === activeIdx
                          ? 'bg-primary/8 text-primary'
                          : 'hover:bg-muted/5 text-secondary',
                      ].join(' ')}
                    >
                      <Search className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>
                        {parts.map((part, j) =>
                          re.test(part) ? (
                            <strong key={j} className="font-semibold">{part}</strong>
                          ) : (
                            <span key={j}>{part}</span>
                          ),
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            // Trending / popular searches (empty state)
            <div className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                <TrendingUp className="w-3.5 h-3.5" />
                {t('trendingSearches')}
              </p>
              <div className="flex flex-wrap gap-2">
                {popularTerms.slice(0, 8).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => selectSuggestion(term)}
                    className="text-xs px-3 py-1.5 border border-border rounded-pill text-secondary hover:border-primary hover:text-primary transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
