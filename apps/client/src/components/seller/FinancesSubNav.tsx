'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

const TABS = [
  { href: '/seller/finances',                key: 'paymentAccount'   },
  { href: '/seller/finances/statements',      key: 'monthlyStatements' },
  { href: '/seller/finances/payment-settings', key: 'paymentSettings'  },
  { href: '/seller/finances/tax-information', key: 'legalTaxInfo'     },
] as const;

/** In-page sub-nav standing in for Etsy's left-nav "Finances" sub-items
 *  (Payment account / Monthly statements / Payment settings / Legal and tax
 *  information) — the seller sidebar in this app is a flat list with no
 *  nested-group support, so this renders as a tab strip at the top of each
 *  Finances page instead of restructuring the sidebar. */
export function FinancesSubNav() {
  const t = useTranslations('seller.finances.subnav');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => {
        const href = `/${locale}${tab.href}`;
        const isActive = pathname === href;
        return (
          <Link
            key={tab.href}
            href={href}
            className={[
              'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-secondary',
            ].join(' ')}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
