'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { useCartStore } from '../../lib/store/cart.store';
import { CLIENT_ROUTES } from '@ezihubb/constants';

/**
 * Fixed bottom navigation bar — mobile only (hidden on md+).
 * Hidden on checkout and full-screen customizer pages.
 */
export function MobileBottomNav() {
  const t        = useTranslations('nav');
  const locale   = useLocale();
  const pathname = usePathname();
  const cart       = useCartStore((s) => s.cart);
  const openDrawer = useCartStore((s) => s.openDrawer);
  const cartCount  = cart?.totals.itemCount ?? 0;

  // Hide on checkout and customizer pages
  const hiddenPaths = [`/${locale}/checkout`, `/customize`];
  if (hiddenPaths.some((p) => pathname.includes(p))) return null;

  const isActive = (href: string) =>
    pathname === `/${locale}${href}` ||
    pathname.startsWith(`/${locale}${href}/`);

  const tabCls = (active: boolean) =>
    [
      'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 text-[10px] font-medium transition-colors',
      active ? 'text-primary' : 'text-muted hover:text-secondary',
    ].join(' ');

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <div className="flex items-stretch h-16 max-w-sm mx-auto">

        {/* Home */}
        <Link href={`/${locale}`} aria-label={t('home')} className={tabCls(pathname === `/${locale}`)}>
          <Home className="w-5 h-5" />
          <span>{t('home')}</span>
        </Link>

        {/* Search */}
        <Link href={`/${locale}${CLIENT_ROUTES.SEARCH}`} aria-label={t('search')} className={tabCls(isActive(CLIENT_ROUTES.SEARCH))}>
          <Search className="w-5 h-5" />
          <span>{t('search')}</span>
        </Link>

        {/* Cart */}
        <button
          type="button"
          onClick={openDrawer}
          aria-label={`${t('cart')}${cartCount > 0 ? ` (${cartCount})` : ''}`}
          className={tabCls(isActive('/cart'))}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center tabular-nums">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </div>
          <span>{t('cart')}</span>
        </button>

        {/* Account */}
        <Link href={`/${locale}${CLIENT_ROUTES.ACCOUNT}`} aria-label={t('account')} className={tabCls(isActive(CLIENT_ROUTES.ACCOUNT))}>
          <User className="w-5 h-5" />
          <span>{t('account')}</span>
        </Link>
      </div>
    </div>
  );
}
