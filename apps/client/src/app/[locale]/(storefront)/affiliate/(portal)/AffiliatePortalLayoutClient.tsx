'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { LayoutDashboard, Link2, Banknote, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@mlh/api-client';
import { useAuthStore } from '../../../../../lib/store/auth.store';

interface AffiliateProfile {
  id:          string;
  status:      'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  referralCode: string;
  balance:     number;
  firstName:   string;
  lastName:    string;
  email:       string;
}

const NAV = [
  { href: '/affiliate/dashboard', icon: LayoutDashboard, label: 'Dashboard'  },
  { href: '/affiliate/links',     icon: Link2,           label: 'My Links'   },
  { href: '/affiliate/payouts',   icon: Banknote,        label: 'Payouts'    },
] as const;

export default function AffiliatePortalLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale   = useLocale();
  const router   = useRouter();
  const pathname = usePathname();
  const token    = useAuthStore((s) => s.accessToken);

  const { data: affiliate, isLoading, isError } = useQuery<AffiliateProfile | null>({
    queryKey: ['affiliate-me'],
    queryFn:  () =>
      apiClient.get<AffiliateProfile>('/affiliates/me', { token: token ?? undefined }),
    enabled:   !!token,
    staleTime: 60_000,
    retry:     false,
  });

  // ── Redirect logic ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;

    // No auth token → middleware should have caught this, but guard here too
    if (!token) {
      router.replace(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // Not an affiliate → send to application form
    if (isError || affiliate === null) {
      router.replace(`/${locale}/affiliate/register`);
      return;
    }

    // Suspended or rejected → send back to landing
    if (affiliate && (affiliate.status === 'SUSPENDED' || affiliate.status === 'REJECTED')) {
      router.replace(`/${locale}/affiliate`);
    }
  }, [affiliate, isLoading, isError, token, router, locale, pathname]);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading || !affiliate) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Pending state ──────────────────────────────────────────────────────────
  if (affiliate.status === 'PENDING') {
    return (
      <div className="max-w-xl mx-auto px-4 md:px-8 py-20 text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl">⏳</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-secondary mb-3">
          Your application is under review
        </h1>
        <p className="text-muted text-sm mb-6">
          We review every application personally. You&apos;ll receive an email at{' '}
          <strong className="text-secondary">{affiliate.email}</strong> within 24 hours.
        </p>
        <Link
          href={`/${locale}/affiliate`}
          className="text-sm text-primary hover:underline"
        >
          ← Back to Affiliate Program
        </Link>
      </div>
    );
  }

  // ── Active portal ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="flex gap-8 items-start">

        {/* Desktop sidebar */}
        <aside className="hidden md:block w-[220px] shrink-0">
          <div className="bg-surface border border-border rounded-card p-4 sticky top-24">
            {/* User pill */}
            <div className="px-2 py-3 mb-2 border-b border-border">
              <p className="text-sm font-semibold text-secondary truncate">
                {affiliate.firstName} {affiliate.lastName}
              </p>
              <p className="text-xs text-muted truncate">{affiliate.referralCode}</p>
              <p className="text-xs font-medium text-green-600 mt-0.5">
                ${Number(affiliate.balance).toFixed(2)} available
              </p>
            </div>

            <nav className="space-y-0.5 mt-1">
              {NAV.map(({ href, icon: Icon, label }) => {
                const fullHref = `/${locale}${href}`;
                const isActive = pathname === fullHref || pathname.startsWith(`${fullHref}/`);
                return (
                  <Link
                    key={href}
                    href={fullHref}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-secondary hover:bg-muted/5 hover:text-primary',
                    ].join(' ')}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`} />
                    {label}
                  </Link>
                );
              })}

              <Link
                href={`/${locale}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-button text-sm font-medium text-secondary hover:bg-error/8 hover:text-error transition-colors mt-1 pt-2 border-t border-border"
              >
                <LogOut className="w-4 h-4 shrink-0 text-muted" />
                Back to Store
              </Link>
            </nav>
          </div>
        </aside>

        {/* Mobile tab bar */}
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-border flex">
          {NAV.map(({ href, icon: Icon, label }) => {
            const fullHref = `/${locale}${href}`;
            const isActive = pathname.startsWith(fullHref);
            return (
              <Link
                key={href}
                href={fullHref}
                className={[
                  'flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted',
                ].join(' ')}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Page content */}
        <main className="flex-1 min-w-0 pb-20 md:pb-0">{children}</main>
      </div>
    </div>
  );
}
