'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useProfile } from '@mlh/api-client';
import { useAuthStore } from '../../../lib/store/auth.store';
import { BrandPanel, BrandStrip } from '../../../components/auth/BrandPanel';

export default function AuthLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale       = useLocale();
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Wait for Zustand persist to rehydrate from localStorage before checking
  // auth state — prevents premature "no user" reads on the first render.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  const storeUser   = useAuthStore((s) => s.user);
  const isAuthReady = useAuthStore((s) => s.isAuthReady);
  const { data: profile, isLoading } = useProfile(hydrated && isAuthReady && !!storeUser);

  // ── Redirect logged-in users away from auth pages ──────────────────────────
  useEffect(() => {
    if (!hydrated || !isAuthReady || isLoading) return;
    if (profile) {
      const redirect = searchParams.get('redirect') ?? `/${locale}/account`;
      router.replace(redirect);
    }
  }, [profile, isLoading, hydrated, isAuthReady, router, locale, searchParams]);

  // ── While hydrating or checking auth, show minimal loading state ───────────
  if (!hydrated || (isAuthReady && isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── If user loaded (and useEffect will redirect), show nothing briefly ─────
  if (profile) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Mobile: compact brand strip at top ── */}
      <div className="md:hidden">
        <BrandStrip />
      </div>

      {/* ── Desktop: split screen 40% / 60% ── */}
      <div className="flex min-h-screen">
        {/* Left: brand panel — hidden on mobile */}
        <div className="hidden md:flex md:w-[40%] lg:w-[38%] min-h-screen">
          <BrandPanel />
        </div>

        {/* Right: form area */}
        <main className="flex-1 flex flex-col items-center justify-center px-5 py-8 md:px-10">
          <div className="w-full max-w-[420px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
