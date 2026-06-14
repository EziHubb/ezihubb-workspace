'use client';

import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../lib/store/auth.store';
import { apiClient } from '@mlh/api-client';
import { API_ROUTES } from '@mlh/constants';

export function OpenShopCta() {
  const t      = useTranslations('home.openShopCta');
  const locale = useLocale();
  const user   = useAuthStore((s) => s.user);
  const token  = useAuthStore((s) => s.accessToken);

  const { data: storeApp } = useQuery<{ status: string }>({
    queryKey: ['my-store-application'],
    queryFn:  () => apiClient.get<{ status: string }>(API_ROUTES.SELLER.STORE_APPLICATION, { token: token ?? undefined }),
    enabled:  !!token,
    staleTime: 30_000,
  });

  const isSeller = (user as unknown as Record<string, unknown> | null)?.['isSeller'] === true
    || storeApp?.status === 'ACTIVE';

  if (isSeller) return null;

  const PERKS = [t('perk1'), t('perk2'), t('perk3'), t('perk4')];
  const EMOJIS = ['🛒', '📦', '🤖', '💸'];

  return (
    <section className="py-14 bg-[#111111]">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-10">

          {/* Left: icon + copy */}
          <div className="flex items-start gap-5 flex-1">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center shrink-0 relative">
              <span className="text-3xl select-none">🏪</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
            </div>
            <div>
              <h3 className="font-display text-2xl font-bold text-white">
                {t('title')}
              </h3>
              <p className="text-white/60 mt-1 text-sm">
                {t('subtitle')}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {PERKS.map((label, i) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/70 text-xs px-3 py-1 rounded-full"
                  >
                    {EMOJIS[i]} {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: CTA */}
          <Link
            href={`/${locale}/open-shop`}
            className="shrink-0 bg-primary hover:bg-primary-dark text-white font-bold text-sm uppercase tracking-wide px-8 py-4 rounded-full transition-colors shadow-md hover:shadow-lg whitespace-nowrap"
          >
            {t('cta')}
          </Link>
        </div>
      </div>
    </section>
  );
}
