'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '../../../lib/store/auth.store';
import { apiClient } from '@ezihubb/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { SellerSidebar } from '../../../components/seller/SellerSidebar';

interface StoreMe {
  id:     string;
  name:   string;
  slug:   string;
  status: string;
}

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const t         = useTranslations('seller.layout');
  const locale    = useLocale();
  const router    = useRouter();
  const pathname  = usePathname();
  const user      = useAuthStore((s) => s.user);
  const token     = useAuthStore((s) => s.accessToken);
  const isReady   = useAuthStore((s) => s.isAuthReady);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: store, isLoading } = useQuery<StoreMe>({
    queryKey: ['store-me'],
    queryFn:  () => apiClient.get<StoreMe>(API_ROUTES.SELLER.STORE_ME, { token: token ?? undefined }),
    enabled:  !!token && isReady,
    retry:    false,
  });

  useEffect(() => {
    if (!isReady) return;
    if (!user) { router.replace(`/${locale}/login?redirect=${pathname}`); return; }
    if (store && store.status !== 'ACTIVE') { router.replace(`/${locale}/open-shop`); }
  }, [isReady, user, store, locale, router, pathname]);

  if (!isReady || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!store || store.status !== 'ACTIVE') return null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-surface border-r border-border">
        <div className="px-4 py-5 border-b border-border">
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{t('hubLabel')}</span>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2">
          <SellerSidebar store={{ name: store.name, slug: store.slug }} />
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-border flex flex-col lg:hidden">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">{t('hubLabel')}</span>
              <button type="button" onClick={() => setSidebarOpen(false)} className="p-1 rounded text-muted hover:text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2">
              <SellerSidebar store={{ name: store.name, slug: store.slug }} onNavigate={() => setSidebarOpen(false)} />
            </div>
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-surface border-b border-border">
          <button type="button" onClick={() => setSidebarOpen(true)} className="p-1.5 rounded text-muted hover:text-secondary">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-sm text-secondary">{store.name}</span>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
