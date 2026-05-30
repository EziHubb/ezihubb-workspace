'use client';

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Search, X, TrendingUp } from 'lucide-react';

// ── Popular search chips (shown when input is empty) ──────────────────────────

const POPULAR_SEARCHES = [
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

const API_BASE = () =>
  (typeof process !== 'undefined' && process.env?.['NEXT_PUBLIC_API_URL']) ||
  'http://localhost:3002';

// ── Props ─────────────────────────────────────────────────────────────────────

interface SearchInputProps {
  /** Initial query value */
  defaultValue?: string;
  /** 'page' = large bar on search page. 'navbar' = compact inline. */
  variant?:      'page' | 'navbar';
  placeholder?:  string;
  className?:    string;
  /** Called when user confirms a search (Enter / suggestion click). */
  onSearch?:     (query: string) => void;
  autoFocus?:    boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchInput({
  defaultValue = '',
  variant      = 'page',
  placeholder  = 'Search gifts, mugs, canvas prints…',
  className    = '',
  onSearch,
  autoFocus    = false,
}: SearchInputProps) {
  const id       = useId();
  const listId   = `${id}-listbox`;
  const router   = useRouter();
  const pathname = usePathname();
  const locale   = useLocale();

  const [value,       setValue]       = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isFocused,   setIsFocused]   = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [activeIdx,   setActiveIdx]   = useState(-1);

  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  // ── Sync defaultValue when it changes externally (page navigation) ─────────
  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  // ── Fetch autocomplete suggestions with AbortController ───────────────────
  const fetchSuggestions = useCallback((q: string) => {
    // Cancel previous inflight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (q.trim().length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    fetch(
      `${API_BASE()}/api/v1/search/suggestions?q=${encodeURIComponent(q)}`,
      { credentials: 'include', signal: controller.signal },
    )
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((body) => {
        setSuggestions((body.data ?? body ?? []).slice(0, 8));
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setIsLoading(false);
      });
  }, []);

  // ── Navigate to search page with current value ────────────────────────────
  const navigate = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      const target  = `/${locale}/search${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ''}`;
      router.push(target);
      onSearch?.(trimmed);
    },
    [locale, router, onSearch],
  );

  // ── Handle input change — debounce both suggestion fetch + navigation ──────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setValue(q);
    setActiveIdx(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(q);
      // Update URL only if we're already on the search page
      if (pathname.includes('/search')) {
        const url = new URL(window.location.href);
        if (q.trim()) url.searchParams.set('q', q.trim());
        else          url.searchParams.delete('q');
        router.replace(url.pathname + url.search);
      }
    }, 300);
  };

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = suggestions.length > 0 ? suggestions : [];
    const max   = items.length - 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i >= max ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? max : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = activeIdx >= 0 ? items[activeIdx] : value;
      setValue(selected ?? value);
      setSuggestions([]);
      setActiveIdx(-1);
      navigate(selected ?? value);
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setActiveIdx(-1);
      inputRef.current?.blur();
    }
  };

  const selectSuggestion = (s: string) => {
    setValue(s);
    setSuggestions([]);
    setActiveIdx(-1);
    navigate(s);
  };

  const clearInput = () => {
    setValue('');
    setSuggestions([]);
    setActiveIdx(-1);
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    inputRef.current?.focus();
    if (pathname.includes('/search')) router.replace(`/${locale}/search`);
  };

  const showDropdown =
    isFocused &&
    (suggestions.length > 0 || (value.trim().length === 0 && !isLoading));

  // ── Styles by variant ──────────────────────────────────────────────────────
  const isPage    = variant === 'page';
  const inputSize = isPage ? 'py-3 text-base pl-12 pr-10' : 'py-2 text-sm pl-9 pr-8';
  const iconSize  = isPage ? 'w-5 h-5 left-4 top-3.5' : 'w-4 h-4 left-2.5 top-2.5';

  return (
    <div className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <Search
          className={`absolute ${iconSize} text-muted pointer-events-none`}
          aria-hidden="true"
        />
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
          onFocus={() => {
            setIsFocused(true);
            if (value.length >= 2) fetchSuggestions(value);
          }}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck="false"
          className={[
            'w-full border border-border rounded-button bg-surface text-secondary',
            'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors',
            inputSize,
          ].join(' ')}
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={clearInput}
            aria-label="Clear search"
            className={[
              'absolute right-0 top-0 h-full px-2.5 flex items-center text-muted hover:text-secondary transition-colors',
            ].join(' ')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface border border-border rounded-card shadow-floating overflow-hidden"
        >
          {suggestions.length > 0 ? (
            // ── Autocomplete suggestions ─────────────────────────────────────
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
                        i === activeIdx ? 'bg-primary/8 text-primary' : 'hover:bg-muted/5 text-secondary',
                      ].join(' ')}
                    >
                      <Search className="w-3.5 h-3.5 text-muted shrink-0" />
                      <span>
                        {parts.map((part, j) =>
                          re.test(part) ? (
                            <strong key={j} className="font-semibold">
                              {part}
                            </strong>
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
            // ── Popular searches (empty state) ─────────────────────────────
            <div className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                <TrendingUp className="w-3.5 h-3.5" />
                Popular searches
              </p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((term) => (
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
