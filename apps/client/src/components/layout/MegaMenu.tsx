'use client';

import { useState, useRef, useCallback, useId } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MegaMenuTab } from '../../types/mega-menu';

interface MegaMenuProps {
  tabs:   MegaMenuTab[];
  locale: string;
}

// ── Active tab detection ───────────────────────────────────────────────────────

function getActiveTabSlug(tabs: MegaMenuTab[], pathname: string, categoryParam?: string | null): string | null {
  const normalized = pathname.replace(/^\/[a-z]{2}(\/|$)/, '/').replace(/^\//, '');

  for (const tab of tabs) {
    if (normalized === tab.navSlug || normalized.startsWith(`${tab.navSlug}/`)) return tab.navSlug;
    for (const group of tab.groups) {
      if (normalized === `categories/${group.slug}`) return tab.navSlug;
      // Search page filtered by this group's category
      if (normalized === 'search' && categoryParam === group.slug) return tab.navSlug;
      for (const item of group.items) {
        if (normalized === `categories/${item.slug}`) return tab.navSlug;
        if (normalized === 'search' && categoryParam === item.slug) return tab.navSlug;
      }
    }
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MegaMenu({ tabs, locale }: MegaMenuProps) {
  const tNav             = useTranslations('nav');
  const pathname        = usePathname();
  const searchParams    = useSearchParams();
  const categoryParam   = searchParams.get('category');
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const openTimerRef    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimerRef   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const menuRef         = useRef<HTMLDivElement>(null);
  const panelId         = useId();
  const activeTabSlug   = getActiveTabSlug(tabs, pathname, categoryParam);
  const currentTab      = tabs.find((t) => t.navSlug === activeTab);

  const clearTimers = () => {
    clearTimeout(openTimerRef.current);
    clearTimeout(closeTimerRef.current);
  };

  const openTab = useCallback((slug: string) => {
    clearTimers();
    openTimerRef.current = setTimeout(() => setActiveTab(slug), 150);
  }, []);

  const startClose = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setActiveTab(null), 200);
  }, []);

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimerRef.current);
  }, []);

  const closeNow = useCallback(() => {
    clearTimers();
    setActiveTab(null);
  }, []);

  // Escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeNow();
  };

  return (
    <nav
      ref={menuRef}
      role="navigation"
      aria-label={tNav('megaMenu.ariaLabel')}
      className="hidden lg:block"
      onMouseLeave={startClose}
      onKeyDown={handleKeyDown}
    >
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1" role="menubar">
        {tabs.map((tab) => {
          const isActive  = activeTab === tab.navSlug;
          const isCurrent = activeTabSlug === tab.navSlug;

          return (
            <button
              key={tab.navSlug}
              type="button"
              role="menuitem"
              aria-expanded={isActive}
              aria-controls={isActive ? `${panelId}-panel` : undefined}
              onMouseEnter={() => openTab(tab.navSlug)}
              onFocus={() => openTab(tab.navSlug)}
              className={[
                'flex items-center gap-0.5 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors rounded-sm',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                isActive || isCurrent
                  ? 'text-primary'
                  : 'text-secondary hover:text-primary',
              ].join(' ')}
            >
              {tab.navLabel}
              {tab.groups.length > 0 && (
                <ChevronDown
                  className={[
                    'w-3 h-3 transition-transform duration-200 shrink-0',
                    isActive ? 'rotate-180' : '',
                  ].join(' ')}
                />
              )}
              {/* Coral active underline */}
              {(isActive || isCurrent) && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Drop-down panel ──────────────────────────────────────────────────── */}
      {activeTab && currentTab && currentTab.groups.length > 0 && (
        <div
          id={`${panelId}-panel`}
          role="region"
          aria-label={currentTab.navLabel}
          onMouseEnter={cancelClose}
          onMouseLeave={startClose}
          className="absolute left-0 right-0 top-full bg-surface border-t border-b border-border shadow-floating z-50"
        >
          <div className="max-w-[1200px] mx-auto px-4 py-6">
            {/* Dynamic grid — up to 6 columns, auto for fewer groups */}
            <div
              className="grid gap-x-8 gap-y-1"
              style={{
                gridTemplateColumns: `repeat(${Math.min(currentTab.groups.length, 6)}, minmax(0, 1fr))`,
              }}
            >
              {currentTab.groups.map((group) => (
                <div key={group.slug}>
                  {/* Group heading — search filtered by this L2 category */}
                  <Link
                    href={`/${locale}/search?category=${group.slug}`}
                    onClick={closeNow}
                    className="block text-[11px] font-bold uppercase tracking-wider text-secondary mb-2 hover:text-primary transition-colors"
                  >
                    {group.title}
                  </Link>

                  {/* L3 items */}
                  <ul className="space-y-1" role="list">
                    {group.items.slice(0, 8).map((item) => (
                      <li key={item.slug}>
                        <Link
                          href={`/${locale}/search?category=${item.slug}`}
                          onClick={closeNow}
                          className="block text-sm text-muted hover:text-primary hover:underline underline-offset-2 transition-colors py-0.5"
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                    {group.items.length > 8 && (
                      <li>
                        <Link
                          href={`/${locale}/search?category=${group.slug}`}
                          onClick={closeNow}
                          className="block text-sm text-primary font-medium hover:underline underline-offset-2 transition-colors py-0.5"
                        >
                          {tNav('viewAll', { category: group.title })} →
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
