import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthLayoutClient from './AuthLayoutClient';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main id="main-content" className="flex min-h-screen items-center justify-center bg-background">
          <span className="sr-only">Loading authentication</span>
          <div aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </main>
      }
    >
      <AuthLayoutClient>{children}</AuthLayoutClient>
    </Suspense>
  );
}
