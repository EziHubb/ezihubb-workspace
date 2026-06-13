'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { X, ChevronDown, LogOut, Package, Settings } from 'lucide-react';
import { queryKeys } from '@mlh/api-client';
import { useAuthStore } from '../../lib/store/auth.store';
import { SearchInput } from '../search/SearchInput';
import { LocaleSwitcher } from './LocaleSwitcher';
import type { MegaMenuTab } from '../../types/mega-menu';

interface MobileNavDrawerProps {
  isOpen:   boolean;
  onClose:  () => void;
  tabs:     MegaMenuTab[];
  locale:   string;
}

// ── Accordion Section ─────────────────────────────────────────────────────────

function AccordionSection({
  title,
  slug,
  locale,
  groups,
  onClose,
}: {
  title:   string;
  slug:    string;
  locale:  string;
  groups:  MegaMenuTab['groups'];
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (groups.length === 0) {
    return (
      <Link
        href={`/${locale}/categories/${slug}`}
        onClick={onClose}
        className="flex items-center px-3 py-3 rounded-button text-sm font-semibold text-secondary hover:bg-muted/5 transition-colors"
      >
        {title}
      </Link>
    );
  }

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-3 text-sm font-semibold text-secondary hover:text-primary transition-colors"
      >
        <span>{title}</span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 text-muted ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="pb-3 px-3 space-y-4">
          {groups.map((group) => (
            <div key={group.slug}>
              {/* L2 group link */}
              <Link
                href={`/${locale}/categories/${group.slug}`}
                onClick={onClose}
                className="block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5 hover:text-primary transition-colors"
              >
                {group.title}
              </Link>

              {/* L3 items */}
              <div className="space-y-0.5 pl-1">
                {group.items.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/${locale}/categories/${item.slug}`}
                    onClick={onClose}
                    className="block py-1.5 text-sm text-secondary hover:text-primary transition-colors"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export function MobileNavDrawer({ isOpen, onClose, tabs, locale }: MobileNavDrawerProps) {
  const router     = useRouter();
  const qc         = useQueryClient();
  const profile    = useAuthStore((s) => s.user);
  const authLogout = useAuthStore((s) => s.logout);
  const drawerRef  = useRef<HTMLDivElement>(null);

  // Focus trap + Escape
  useEffect(() => {
    if (!isOpen) return;
    drawerRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSignOut = async () => {
    onClose();
    await authLogout();
    qc.setQueryData(queryKeys.profile(), null);
    qc.clear();
    router.push(`/${locale}`);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="lg:hidden fixed inset-0 z-[59] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — slides from left */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="lg:hidden fixed inset-y-0 left-0 z-[60] flex flex-col w-[min(85vw,360px)] bg-surface shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <Link href={`/${locale}`} onClick={onClose} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold font-display text-base">M</span>
            </div>
            <span className="font-display font-bold text-lg text-secondary">Daily Daisy</span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="min-h-11 min-w-11 flex items-center justify-center text-muted hover:text-secondary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border shrink-0">
          <SearchInput
            variant="page"
            placeholder="Search gifts…"
            onSearch={onClose}
          />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Mega-menu tabs as accordion */}
          <div className="px-2 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-3 py-2">
              Shop
            </p>
            {tabs.map((tab) => (
              <AccordionSection
                key={tab.navSlug}
                title={tab.navLabel}
                slug={tab.navSlug}
                locale={locale}
                groups={tab.groups}
                onClose={onClose}
              />
            ))}

            {/* Extra nav links */}
            <div className="mt-2 pt-2 border-t border-border space-y-0.5">
              {[
                { href: `/${locale}/collections`, label: 'Collections'  },
                { href: `/${locale}/occasions`,   label: 'Occasions'    },
                { href: `/${locale}/gift-cards`,  label: 'Gift Cards'   },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className="flex items-center px-3 py-3 rounded-button text-sm font-medium text-secondary hover:bg-muted/5 transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Account section */}
          <div className="px-2 py-3 border-t border-border mt-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted px-3 py-2">
              Account
            </p>

            {profile ? (
              <>
                <div className="flex items-center gap-3 px-3 py-2 mb-1">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                    {profile.avatarUrl ? (
                      <Image src={profile.avatarUrl} alt="" width={36} height={36} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-primary font-bold text-xs">
                        {`${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-secondary text-sm truncate">
                      {profile.firstName} {profile.lastName}
                    </p>
                    <p className="text-xs text-muted truncate">{profile.email}</p>
                  </div>
                </div>

                {[
                  { href: `/${locale}/account/orders`,   label: 'My Orders', icon: Package  },
                  { href: `/${locale}/account/profile`,  label: 'Profile',   icon: Settings },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-button text-sm text-secondary hover:bg-muted/5 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-muted" />
                    {label}
                  </Link>
                ))}

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-button text-sm text-secondary hover:bg-error/8 hover:text-error transition-colors"
                >
                  <LogOut className="w-4 h-4 text-muted" />
                  Sign Out
                </button>
              </>
            ) : (
              <div className="px-3 space-y-2">
                <Link
                  href={`/${locale}/login`}
                  onClick={onClose}
                  className="block w-full text-center py-2.5 bg-primary hover:bg-primary-dark text-white font-bold text-sm rounded-button transition-colors uppercase tracking-wide"
                >
                  Sign In
                </Link>
                <Link
                  href={`/${locale}/register`}
                  onClick={onClose}
                  className="block text-center py-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Footer: language switcher + socials */}
        <div className="px-4 py-3 border-t border-border shrink-0 space-y-3">
          <div className="flex items-center justify-center">
            <LocaleSwitcher variant="inline" />
          </div>
          <div className="flex gap-4 justify-center">
            {['Instagram', 'TikTok', 'Pinterest', 'Facebook'].map((sn) => (
              <a
                key={sn}
                href="#"
                aria-label={sn}
                className="text-muted hover:text-primary transition-colors text-xs font-medium"
              >
                {sn}
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
