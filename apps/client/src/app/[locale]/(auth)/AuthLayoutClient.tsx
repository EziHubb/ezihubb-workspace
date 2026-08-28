'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import { BrandPanel, BrandStrip } from '../../../components/auth/BrandPanel';
import { resolveAuthRedirect } from '../../../lib/auth-redirect';

export default function AuthLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale       = useLocale();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const { status } = useSession();

  // Redirect logged-in users away from auth pages
  useEffect(() => {
    if (status !== 'authenticated') return;
    const redirect = resolveAuthRedirect(searchParams.get('redirect'), `/${locale}/account`);
    router.replace(redirect);
  }, [status, router, locale, searchParams]);

  // Show spinner while checking session or while about to redirect
  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
