'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search, Heart, ShoppingBag, Menu,
  ChevronDown, Package, Settings, LogOut, Star, Store,
} from 'lucide-react';
import { useWishlist, queryKeys } from '@mlh/api-client';
import { signOut } from 'next-auth/react';
import { useCartStore } from '../../lib/store/cart.store';
import { useAuthStore } from '../../lib/store/auth.store';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';
import { CartDrawer } from './CartDrawer';
import { SearchInput } from '../search/SearchInput';
import { MegaMenu } from './MegaMenu';
import { MobileNavDrawer } from './MobileNavDrawer';
import { LocaleSwitcher } from './LocaleSwitcher';
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
  const token            = useAuthStore((s) => s.accessToken);

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ['coins', 'me'],
    queryFn:  () => apiClient.get<{ balance: number }>(API_ROUTES.COINS.ME, { token: token ?? undefined }),
    enabled:  !!token,
    staleTime: 60_000,
  });

  // Live store status — JWT may be stale (isSeller not updated until re-login)
  const { data: storeApp } = useQuery<{ status: string }>({
    queryKey: ['my-store-application'],
    queryFn:  () => apiClient.get<{ status: string }>(API_ROUTES.SELLER.STORE_APPLICATION, { token: token ?? undefined }),
    enabled:  !!token,
    staleTime: 30_000,
  });

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
    await signOut({ redirect: false });
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
  const adminUrl = process.env['NEXT_PUBLIC_ADMIN_URL'] ?? 'http://localhost:3001';
  const isSeller = (profile as unknown as Record<string, unknown>)['isSeller'] === true
    || storeApp?.status === 'ACTIVE';
  const shopLink = isSeller ? adminUrl : `/${locale}/open-shop`;

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
            {coinData !== undefined && (
              <div className="mt-1.5 inline-flex items-center gap-1 bg-primary/8 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                <Star className="w-3 h-3" />
                {coinData.balance.toLocaleString()} coins
              </div>
            )}
          </div>
          {[
            { icon: Package,  label: 'My Orders',                          href: `/${locale}/account/orders`  },
            { icon: Settings, label: 'Profile',                             href: `/${locale}/account/profile` },
            { icon: Store,    label: isSeller ? 'Seller Hub' : 'Open a Shop', href: shopLink },
          ].map(({ icon: Icon, label, href }) => (
            <Link
              key={label}
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
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const token_      = useAuthStore((s) => s.accessToken);
  const adminUrl    = process.env['NEXT_PUBLIC_ADMIN_URL'] ?? 'http://localhost:3001';

  // Shared cache key with UserMenu — served from cache after first fetch
  const { data: storeApp_ } = useQuery<{ status: string }>({
    queryKey: ['my-store-application'],
    queryFn:  () => apiClient.get<{ status: string }>(API_ROUTES.SELLER.STORE_APPLICATION, { token: token_ ?? undefined }),
    enabled:  !!token_ && isAuthReady,
    staleTime: 30_000,
  });

  const isSeller    = (user as unknown as Record<string, unknown> | null)?.['isSeller'] === true
    || storeApp_?.status === 'ACTIVE';
  const shopHref    = isSeller ? adminUrl : `/${locale}/open-shop`;
  const { data: wishlistItems } = useWishlist(isAuthReady && !!user);
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
          'w-full bg-surface transition-shadow duration-300',
          isScrolled ? 'shadow-floating' : '',
        ].join(' ')}
      >
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8">
          {/* ── Row 1: Logo + Search + Icons ───────────────────────────────── */}
          <div className="flex items-center h-16 md:h-[72px] gap-3 md:gap-4">

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
                  Daily Daisy
                </span>
              </Link>
            </div>

            {/* Center: large search bar (desktop only) */}
            <div className="hidden lg:flex flex-1 justify-center px-6">
              <div className="w-full max-w-2xl">
                <SearchInput variant="header" placeholder={t('search')} className="w-full" />
              </div>
            </div>

            {/* Right: icons + user */}
            <div className="flex items-center gap-1.5 md:gap-2.5 ml-auto lg:ml-0 shrink-0">
              {/* Mobile search icon */}
              <Link
                href={`/${locale}/search`}
                aria-label={t('search')}
                className="lg:hidden min-h-11 min-w-11 flex items-center justify-center hover:bg-muted/10 rounded-full transition-colors"
              >
                <Search className="w-5 h-5 text-secondary" />
              </Link>

              {/* Language picker — desktop only */}
              <div className="hidden md:block">
                <LocaleSwitcher />
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

              {/* Shop icon — desktop only */}
              <Link
                href={shopHref}
                aria-label={isSeller ? 'My Shop' : 'Open a Shop'}
                className="hidden md:flex relative p-2 hover:bg-muted/10 rounded-full transition-colors"
              >
                <Store className="w-5 h-5 text-secondary" />
              </Link>

              <UserMenu locale={locale} />
            </div>
          </div>

          {/* ── Row 2: Category Nav (desktop only) ─────────────────────────── */}
          <div className="hidden lg:flex items-center border-t border-border/60">
            {tabs.length > 0 ? (
              <Suspense fallback={null}>
                <MegaMenu tabs={tabs} locale={locale} />
              </Suspense>
            ) : (
              <div className="flex items-center gap-6 h-10">
                {[
                  { href: `/${locale}/search`,       label: t('shopAll')     },
                  { href: `/${locale}/collections`,  label: t('collections') },
                  { href: `/${locale}/occasions`,    label: t('occasions')   },
                  { href: `/${locale}/gift-cards`,   label: t('giftCards')   },
                  { href: `/${locale}/flash-deals`,  label: 'Flash Deals'    },
                  { href: `/${locale}/gift-pools`,   label: 'Group Gift'     },
                  { href: `/${locale}/blind-match`,  label: 'Blind Match'    },
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
