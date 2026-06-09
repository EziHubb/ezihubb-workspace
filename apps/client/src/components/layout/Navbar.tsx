'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search, Heart, ShoppingBag, Menu,
  ChevronDown, Package, Settings, LogOut,
} from 'lucide-react';
import { useWishlist, queryKeys } from '@mlh/api-client';
import { useCartStore } from '../../lib/store/cart.store';
import { useAuthStore } from '../../lib/store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import { CartDrawer } from './CartDrawer';
import { SearchInput } from '../search/SearchInput';
import { MegaMenu } from './MegaMenu';
import { MobileNavDrawer } from './MobileNavDrawer';
import { CurrencyPicker } from './CurrencyPicker';
import type { MegaMenuTab } from '../../types/mega-menu';

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center tabular-nums pointer-events-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ── User Menu (desktop) ───────────────────────────────────────────────────────

function UserMenu({ locale }: { locale: string }) {
  const [open, setOpen]  = useState(false);
  const menuRef          = useRef<HTMLDivElement>(null);
  const router           = useRouter();
  const qc               = useQueryClient();
  const profile          = useAuthStore((s) => s.user);
  const authLogout       = useAuthStore((s) => s.logout);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    await authLogout();
    qc.setQueryData(queryKeys.profile(), null);
    qc.clear();
    router.push(`/${locale}`);
  };

  if (!profile) {
    return (
      <Link
        href={`/${locale}/login`}
        className="hidden md:block bg-primary hover:bg-primary-dark text-white font-semibold text-sm px-5 py-2 rounded-button transition-colors uppercase tracking-wide"
      >
        Sign In
      </Link>
    );
  }

  const initials = `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <div className="relative hidden md:block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2"
      >
        <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
          {profile.avatarUrl ? (
            <Image
              src={profile.avatarUrl}
              alt={`${profile.firstName} ${profile.lastName}`}
              width={32}
              height={32}
              className="object-cover w-full h-full"
            />
          ) : (
            <span className="text-primary font-bold text-xs">{initials}</span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-card shadow-floating z-50 py-1 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <p className="font-semibold text-secondary text-sm truncate">
              {profile.firstName} {profile.lastName}
            </p>
            <p className="text-xs text-muted truncate">{profile.email}</p>
          </div>
          {[
            { icon: Package,  label: 'My Orders', href: `/${locale}/account/orders`  },
            { icon: Settings, label: 'Profile',   href: `/${locale}/account/profile` },
          ].map(({ icon: Icon, label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:bg-muted/5 hover:text-primary transition-colors"
            >
              <Icon className="w-4 h-4 text-muted" />
              {label}
            </Link>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-secondary hover:bg-error/8 hover:text-error transition-colors"
            >
              <LogOut className="w-4 h-4 text-muted" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export interface NavbarProps {
  /** Mega-menu data fetched server-side (revalidate 600s). Null when API is unavailable. */
  menuData?: MegaMenuTab[] | null;
}

export function Navbar({ menuData }: NavbarProps = {}) {
  const t            = useTranslations('nav');
  const locale       = useLocale();
  const pathname     = usePathname();
  const [isScrolled, setIsScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  const user        = useAuthStore((s) => s.user);
  const { data: wishlistItems } = useWishlist(!!user);
  const cart        = useCartStore((s) => s.cart);
  const openDrawer  = useCartStore((s) => s.openDrawer);
  const cartCount   = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const wishlistCount = wishlistItems?.length ?? 0;

  // Scroll shadow
  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const tabs = menuData ?? [];

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <nav
        className={[
          'fixed top-0 left-0 right-0 z-50 bg-surface transition-shadow duration-300',
          isScrolled ? 'shadow-floating' : '',
        ].join(' ')}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[60px] gap-4 relative">

            {/* Left: hamburger (mobile) + logo */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                className="lg:hidden min-h-11 min-w-11 flex items-center justify-center -ml-2"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={mobileOpen}
              >
                <Menu className="w-6 h-6 text-secondary" />
              </button>

              <Link href={`/${locale}`} className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-9 md:h-9 bg-primary rounded-lg flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-xl font-display">M</span>
                </div>
                <span className="font-display font-bold text-lg md:text-xl text-secondary hidden sm:block">
                  Maple Handmade
                </span>
              </Link>
            </div>

            {/* Center: mega menu tabs (desktop) OR simple links fallback */}
            <div className="hidden lg:flex items-center flex-1 justify-center">
              {tabs.length > 0 ? (
                <MegaMenu tabs={tabs} locale={locale} />
              ) : (
                /* Fallback simple nav when mega-menu data is unavailable */
                <div className="flex items-center gap-6">
                  {[
                    { href: `/${locale}/products`,    label: t('shopAll')     },
                    { href: `/${locale}/collections`, label: t('collections') },
                    { href: `/${locale}/occasions`,   label: t('occasions')   },
                    { href: `/${locale}/gift-cards`,  label: t('giftCards')   },
                  ].map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className={[
                        'text-sm font-medium transition-colors whitespace-nowrap',
                        pathname === href ? 'text-primary' : 'text-secondary hover:text-primary',
                      ].join(' ')}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Right: search + icons + user */}
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {/* Desktop search bar */}
              <div className="hidden lg:block w-40 xl:w-52">
                <SearchInput variant="navbar" placeholder={t('search')} />
              </div>

              {/* Mobile search icon */}
              <Link
                href={`/${locale}/search`}
                aria-label={t('search')}
                className="lg:hidden min-h-11 min-w-11 flex items-center justify-center hover:bg-muted/10 rounded-full transition-colors"
              >
                <Search className="w-5 h-5 text-secondary" />
              </Link>

              {/* Currency picker — desktop only */}
              <div className="hidden md:block">
                <CurrencyPicker />
              </div>

              {/* Wishlist — desktop only */}
              <Link
                href={`/${locale}/account/wishlist`}
                aria-label={`${t('wishlist')}${wishlistCount > 0 ? ` (${wishlistCount})` : ''}`}
                className="hidden md:flex relative p-2 hover:bg-muted/10 rounded-full transition-colors"
              >
                <Heart className="w-5 h-5 text-secondary" />
                <Badge count={wishlistCount} />
              </Link>

              {/* Cart — desktop drawer / mobile link */}
              <button
                type="button"
                onClick={openDrawer}
                aria-label={`${t('cart')}${cartCount > 0 ? ` (${cartCount})` : ''}`}
                className="hidden md:flex relative p-2 hover:bg-muted/10 rounded-full transition-colors"
              >
                <ShoppingBag className="w-5 h-5 text-secondary" />
                <Badge count={cartCount} />
              </button>
              <Link
                href={`/${locale}/cart`}
                aria-label={`${t('cart')}${cartCount > 0 ? ` (${cartCount})` : ''}`}
                className="md:hidden relative p-2 hover:bg-muted/10 rounded-full transition-colors"
              >
                <ShoppingBag className="w-5 h-5 text-secondary" />
                <Badge count={cartCount} />
              </Link>

              <UserMenu locale={locale} />
            </div>
          </div>
        </div>
      </nav>

      {/* Cart drawer */}
      <CartDrawer />

      {/* Mobile full-screen nav drawer */}
      <MobileNavDrawer
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        tabs={tabs}
        locale={locale}
      />
    </>
  );
}
