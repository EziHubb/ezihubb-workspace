'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Menu, AlertCircle, Clock } from 'lucide-react';
import { ToastProvider } from '@mlh/ui';
import { useProfile } from '@mlh/api-client';
import { useAuthStore } from '../../../lib/store/auth.store';
import { useAuthQuery } from '../../../lib/hooks/useAuthQuery';
import { SellerSidebar } from '../../../components/seller/SellerSidebar';

interface StoreDto {
  id:             string;
  name:           string;
  slug:           string;
  status:         'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  rejectedReason: string | null;
  adminNotes:     string | null;
}

export default function SellerLayoutClient({ children }: { children: React.ReactNode }) {
  const locale   = useLocale();
  const router   = useRouter();
  const pathname = usePathname();

  const storeUser   = useAuthStore((s) => s.user);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const { data: profile, isLoading: profileLoading, isError: profileError } = useProfile(isAuthReady && !!storeUser);
  const { data: store,   isLoading: storeLoading,   isError: storeError   } = useAuthQuery<StoreDto>(
    ['seller', 'store', 'me'],
    '/stores/me',
    undefined,
    { enabled: isAuthReady && !!storeUser },
  );

  const [mobileOpen, setMobileOpen] = useState(false);

  const isApplyPath = pathname.endsWith('/seller/apply');
  const isLoading   = profileLoading || storeLoading;

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthReady || isLoading) return;
    if (profileError || !profile) {
      const redirect = encodeURIComponent(pathname);
      router.replace(`/${locale}/login?redirect=${redirect}`);
    }
  }, [profile, isLoading, profileError, isAuthReady, router, locale, pathname]);

  // ── Store redirect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthReady || isLoading) return;
    if (profile && (storeError || !store) && !isApplyPath) {
      router.replace(`/${locale}/seller/apply`);
    }
  }, [store, isLoading, storeError, profile, isApplyPath, isAuthReady, router, locale]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Apply page (no store yet) ────────────────────────────────────────────────
  if (!store || storeError) {
    if (isApplyPath) {
      return (
        <ToastProvider>
          <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
            {children}
          </div>
        </ToastProvider>
      );
    }
    return null;
  }

  // ── Pending approval ────────────────────────────────────────────────────────
  if (store.status === 'PENDING') {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="font-display text-2xl font-bold text-secondary">Application Under Review</h1>
            <p className="text-muted">
              Your store <strong className="text-secondary">{store.name}</strong> is pending approval.
              We typically review applications within 1–2 business days.
            </p>
            {store.adminNotes && (
              <p className="text-sm text-muted bg-amber-50 border border-amber-200 rounded-card p-3">
                {store.adminNotes}
              </p>
            )}
          </div>
        </div>
      </ToastProvider>
    );
  }

  // ── Rejected ─────────────────────────────────────────────────────────────────
  if (store.status === 'REJECTED') {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-error" />
            </div>
            <h1 className="font-display text-2xl font-bold text-secondary">Application Not Approved</h1>
            <p className="text-muted">
              Unfortunately your store application was not approved.
            </p>
            {store.rejectedReason && (
              <p className="text-sm text-muted bg-error/5 border border-error/20 rounded-card p-3">
                {store.rejectedReason}
              </p>
            )}
          </div>
        </div>
      </ToastProvider>
    );
  }

  // ── Suspended ────────────────────────────────────────────────────────────────
  if (store.status === 'SUSPENDED') {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-error" />
            </div>
            <h1 className="font-display text-2xl font-bold text-secondary">Store Suspended</h1>
            <p className="text-muted">
              Your store has been temporarily suspended. Please contact support for assistance.
            </p>
          </div>
        </div>
      </ToastProvider>
    );
  }

  // ── Active seller dashboard ──────────────────────────────────────────────────
  return (
    <ToastProvider>
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 md:py-12">

        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open seller menu"
            className="p-2 border border-border rounded-button text-secondary hover:border-primary transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <p className="font-semibold text-secondary text-sm">{store.name}</p>
            <p className="text-xs text-muted">Seller Dashboard</p>
          </div>
        </div>

        <div className="flex gap-8 items-start">
          {/* Desktop sidebar */}
          <div className="hidden md:block w-[240px] shrink-0">
            <SellerSidebar store={store} />
          </div>

          {/* Page content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex items-end">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div className="relative w-full bg-surface rounded-t-2xl z-10 pb-safe">
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-border rounded-full" />
              </div>
              <div className="px-2 pb-6">
                <SellerSidebar store={store} onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
