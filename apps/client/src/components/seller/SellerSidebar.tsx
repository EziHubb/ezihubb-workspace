'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  BarChart2,
  Wallet,
  Store,
  Star,
  LogOut,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { useAuthStore } from '../../lib/store/auth.store';

interface SellerSidebarProps {
  store:       { name: string; slug: string };
  onNavigate?: () => void;
}

export function SellerSidebar({ store, onNavigate }: SellerSidebarProps) {
  const t        = useTranslations('seller.sidebar');
  const locale   = useLocale();
  const pathname = usePathname();
  const router   = useRouter();
  const qc       = useQueryClient();

  const handleSignOut = async () => {
    try { await apiClient.post(API_ROUTES.AUTH.LOGOUT); } catch { /* noop */ }
    localStorage.removeItem('access_token');
    qc.clear();
    useAuthStore.setState({ user: null, accessToken: null });
    router.push(`/${locale}`);
  };

  const NAV_LINKS = [
    { href: '/seller',          icon: LayoutDashboard, label: t('nav.dashboard')     },
    { href: '/seller/orders',   icon: ShoppingBag,     label: t('nav.orders')        },
    { href: '/seller/products', icon: Package,         label: t('nav.products')      },
    { href: '/seller/analytics', icon: BarChart2, label: t('nav.analytics')       },
    { href: '/seller/reviews',   icon: Star,     label: t('nav.reviews')         },
    { href: '/seller/finances',  icon: Wallet,   label: t('nav.finances')        },
    { href: '/seller/store',     icon: Store,    label: t('nav.storeSettings')   },
  ] as const;

  return (
    <nav aria-label={t('aria')} className="space-y-1">
      {/* Store badge */}
      <div className="px-3 py-4 mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">{t('yourStore')}</p>
        <p className="font-semibold text-secondary text-sm truncate">{store.name}</p>
        <a
          href={`/${locale}/shops/${store.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline"
        >
          {t('viewPublicPage')} →
        </a>
      </div>

      {NAV_LINKS.map(({ href, icon: Icon, label }) => {
        const fullHref = `/${locale}${href}`;
        const isActive =
          href === '/seller'
            ? pathname === fullHref
            : pathname === fullHref || pathname.startsWith(`${fullHref}/`);

        return (
          <Link
            key={href}
            href={fullHref}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-secondary hover:bg-muted/5 hover:text-primary',
            ].join(' ')}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`} />
            <span>{label}</span>
          </Link>
        );
      })}

      <button
        type="button"
        onClick={handleSignOut}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium text-secondary hover:bg-error/8 hover:text-error transition-colors mt-2"
      >
        <LogOut className="w-4 h-4 shrink-0 text-muted" />
        {t('signOut')}
      </button>
    </nav>
  );
}
