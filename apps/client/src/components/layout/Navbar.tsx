'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search, Heart, ShoppingBag, Menu,
  ChevronDown, Package, Settings, LogOut, Store, MessageSquare, Tag,
} from 'lucide-react';
import { Tooltip } from '@ezihubb/ui';
import { NotificationBell } from './NotificationBell';
import { Badge } from './HeaderBadge';
import { ViewportPortal } from './ViewportPortal';
import { useWishlist, queryKeys } from '@ezihubb/api-client';
import { signOut } from 'next-auth/react';
import { useCartStore } from '../../lib/store/cart.store';
import { useAuthStore } from '../../lib/store/auth.store';
import { toast } from '../../lib/store/toast.store';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { CartDrawer } from './CartDrawer';
import { SearchInput } from '../search/SearchInput';
import { MegaMenu } from './MegaMenu';
import { MobileNavDrawer } from './MobileNavDrawer';
import { LocaleSwitcher } from './LocaleSwitcher';
import type { MegaMenuTab } from '../../types/mega-menu';
import { buildLoginHref } from '../../lib/auth-redirect';

// ── User Menu (desktop) ───────────────────────────────────────────────────────

function UserMenu({ locale, loginHref }: { locale: string; loginHref: string }) {
  const t                = useTranslations('nav');
  const [open, setOpen]  = useState(false);
  const menuRef          = useRef<HTMLDivElement>(null);
  const router           = useRouter();
  const qc               = useQueryClient();
  const profile          = useAuthStore((s) => s.user);
  const authLogout       = useAuthStore((s) => s.logout);
  const token            = useAuthStore((s) => s.accessToken);


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
    try {
      await authLogout();
    } catch {
      // Stay signed in and stay on the page. The server still holds a valid
      // refresh token, so clearing the UI would tell the user they are signed
      // out while their session is very much alive — the worst outcome on a
      // shared computer. Say so instead and let them retry.
      toast.error(t('signOutFailed'), { description: t('signOutFailedHint') });
      return;
    }
    qc.setQueryData(queryKeys.profile(), null);
    qc.clear();
    await signOut({ redirect: false });
    router.push(`/${locale}`);
  };

  if (!profile) {
    return (
      <Link
        href={loginHref}
        className="hidden md:block bg-primary hover:bg-primary-dark text-white font-semibold text-sm px-5 py-2 rounded-button transition-colors uppercase tracking-wide"
      >
        {t('signIn')}
      </Link>
    );
  }

  const initials = `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || '?';
  const adminUrl  = process.env['NEXT_PUBLIC_ADMIN_URL'] ?? 'http://localhost:3001';
  const isSeller  = (profile as unknown as Record<string, unknown>)['isSeller'] === true
    || storeApp?.status === 'ACTIVE';

  return (
    <div className="relative hidden md:block" ref={menuRef}>
      {/* Suppressed while the menu is open: focus stays on this button after
          the click, so the tooltip would otherwise sit on top of the menu it
          just opened.
          This was also the only control in the row with no accessible name —
          the avatar image alt is decorative, and vanishes entirely when the
          user has no photo and only initials render. */}
      <Tooltip label={t('tipAccount')} disabled={open}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={t('tipAccount')}
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
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-card shadow-floating z-50 py-1 overflow-hidden">
          {/* The header row is a link now, not a static block. In the
              reference the name doubles as "view your profile", and a
              non-interactive block at the top of a menu of links is the one
              place people click expecting something to happen. */}
          <Link
            href={`/${locale}/account/profile`}
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 border-b border-border hover:bg-muted/5 transition-colors"
          >
            <p className="font-semibold text-secondary text-sm truncate">
              {profile.firstName} {profile.lastName}
            </p>
            <p className="text-xs text-muted truncate">{t('viewProfile')}</p>
          </Link>
          {[
            { icon: Package,       label: t('myOrders'), href: `/${locale}/account/orders`,   newTab: false },
            // Both of these already have real pages; the menu simply never
            // linked to them. Every entry here must point at a route that
            // exists — a menu item leading to a blank page is worse than a
            // missing one.
            { icon: MessageSquare, label: t('messages'), href: `/${locale}/account/messages`, newTab: false },
            { icon: Tag,           label: t('offers'),   href: `/${locale}/account/offers`,   newTab: false },
            { icon: Settings,      label: t('profile'),  href: `/${locale}/account/profile`,  newTab: false },
            // "Open a Shop" is intentionally not offered here — the storefront
            // must not present as a multi-seller marketplace (Pinterest merchant
            // policy). Existing sellers still get a link to their own Seller Hub.
            ...(isSeller ? [{ icon: Store, label: t('sellerHub'), href: adminUrl, newTab: true }] : []),
            // Deliberately absent: a balance/credit entry, and a gift-registry
            // entry. Buyers have no wallet in this system — SellerLedgerEntry
            // is shop-scoped — and there is no registry feature at all.
          ].map(({ icon: Icon, label, href, newTab }) => (
            <Link
              key={label}
              href={href}
              onClick={() => setOpen(false)}
              {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
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
              {t('signOut')}
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
  const searchParams = useSearchParams();
  const [isScrolled, setIsScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  const user        = useAuthStore((s) => s.user);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const token_      = useAuthStore((s) => s.accessToken);
  // Shared cache key with UserMenu — served from cache after first fetch
  const { data: storeApp_ } = useQuery<{ status: string }>({
    queryKey: ['my-store-application'],
    queryFn:  () => apiClient.get<{ status: string }>(API_ROUTES.SELLER.STORE_APPLICATION, { token: token_ ?? undefined }),
    enabled:  !!token_ && isAuthReady,
    staleTime: 30_000,
  });

  const adminUrl_   = process.env['NEXT_PUBLIC_ADMIN_URL'] ?? 'http://localhost:3001';
  const isSeller    = (user as unknown as Record<string, unknown> | null)?.['isSeller'] === true
    || storeApp_?.status === 'ACTIVE';
  const { data: wishlistItems } = useWishlist(isAuthReady && !!user);
  const cart        = useCartStore((s) => s.cart);
  const openDrawer  = useCartStore((s) => s.openDrawer);
  const cartCount   = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const wishlistCount = wishlistItems?.length ?? 0;
  const search         = searchParams.toString();
  const currentUrl     = `${pathname}${search ? `?${search}` : ''}`;
  const loginHref      = buildLoginHref(locale, currentUrl);

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
                aria-label={t('toggleMenu')}
                aria-expanded={mobileOpen}
              >
                <Menu className="w-6 h-6 text-secondary" />
              </button>

              <Link href={`/${locale}`} className="flex items-center shrink-0">
                <Image
                  src="/logo.png"
                  alt="EziHubb"
                  width={182}
                  height={52}
                  priority
                  className="h-10 md:h-11 w-auto object-contain"
                />
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
              {/* Mobile search icon.
                  Every icon-only control in this row is wrapped in Tooltip:
                  the icons carry no visible text, so hover/focus is the only
                  place their meaning can appear. aria-label stays on each
                  trigger — Tooltip adds aria-describedby rather than replacing
                  the accessible name. */}
              <Tooltip label={t('tipSearch')}>
                <Link
                  href={`/${locale}/search`}
                  aria-label={t('search')}
                  className="lg:hidden min-h-11 min-w-11 flex items-center justify-center hover:bg-muted/10 rounded-full transition-colors"
                >
                  <Search className="w-5 h-5 text-secondary" />
                </Link>
              </Tooltip>

              {/* Language picker — desktop only */}
              <div className="hidden md:block">
                <LocaleSwitcher />
              </div>

              {/* Wishlist — desktop only */}
              <Tooltip label={t('tipWishlist')}>
                <Link
                  href={`/${locale}/account/wishlist`}
                  aria-label={`${t('wishlist')}${wishlistCount > 0 ? ` (${wishlistCount})` : ''}`}
                  className="hidden md:flex relative p-2 hover:bg-muted/10 rounded-full transition-colors"
                >
                  <Heart className="w-5 h-5 text-secondary" />
                  <Badge count={wishlistCount} />
                </Link>
              </Tooltip>

              {/* Notifications — signed-in only. The feed endpoints are
                  authenticated, so rendering the bell for a guest would give
                  them a control whose every request 401s. */}
              {user && <NotificationBell />}

              {/* Shop Manager — a top-level shortcut for people who already
                  have a shop, matching the reference. Deliberately NOT an
                  "open a shop" invitation: the storefront must not present as
                  a multi-seller marketplace (Pinterest merchant policy), which
                  is why this renders only when isSeller is already true and
                  never prompts anyone else to become one. */}
              {isSeller && (
                <Tooltip label={t('shopManager')}>
                  <a
                    href={adminUrl_}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('shopManager')}
                    className="hidden md:flex p-2 hover:bg-muted/10 rounded-full transition-colors"
                  >
                    <Store className="w-5 h-5 text-secondary" />
                  </a>
                </Tooltip>
              )}

              {/* Cart — desktop drawer / mobile link */}
              <Tooltip label={t('tipCart')}>
                <button
                  type="button"
                  onClick={openDrawer}
                  aria-label={`${t('cart')}${cartCount > 0 ? ` (${cartCount})` : ''}`}
                  className="hidden md:flex relative p-2 hover:bg-muted/10 rounded-full transition-colors"
                >
                  <ShoppingBag className="w-5 h-5 text-secondary" />
                  <Badge count={cartCount} />
                </button>
              </Tooltip>
              <Link
                href={`/${locale}/cart`}
                aria-label={`${t('cart')}${cartCount > 0 ? ` (${cartCount})` : ''}`}
                className="md:hidden relative p-2 hover:bg-muted/10 rounded-full transition-colors"
              >
                <ShoppingBag className="w-5 h-5 text-secondary" />
                <Badge count={cartCount} />
              </Link>

              {/* Shop icon — only shown to existing sellers (their own Seller
                  Hub), never as a public "open a shop" invite — see the
                  matching note in UserMenu above. */}
              {isSeller && (
              <Tooltip label={t('tipSellerHub')}>
                <Link
                  href={adminUrl_}
                  aria-label={t('sellerHub')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex relative p-2 hover:bg-muted/10 rounded-full transition-colors"
                >
                  <Store className="w-5 h-5 text-secondary" />
                </Link>
              </Tooltip>
              )}

              <UserMenu locale={locale} loginHref={loginHref} />
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

      {/* Both drawers cover the viewport, so they are portalled to body rather
          than left inside the header. StickyHeader animates with a transform,
          and a transformed ancestor becomes the containing block for
          position:fixed descendants — which turned the drawers' "fixed" from
          "the viewport" into "the header box", and parked the closed cart panel
          outside it wide enough to give every page a horizontal scrollbar. */}
      <ViewportPortal>
        {/* Cart drawer */}
        <CartDrawer />

        {/* Mobile full-screen nav drawer */}
        <MobileNavDrawer
          isOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
          tabs={tabs}
          locale={locale}
          loginHref={loginHref}
        />
      </ViewportPortal>
    </>
  );
}
