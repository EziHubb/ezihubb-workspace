'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertOctagon, CheckCircle2, Circle, ExternalLink, ClipboardCheck,
} from 'lucide-react';
import { fmtAmount } from '../../lib/fmt';

interface ShopHealthChecklist {
  shopName:    boolean;
  logo:        boolean;
  banner:      boolean;
  story:       boolean;
  sellerPhoto: boolean;
}

interface ShopHealth {
  shopName:       string | null;
  shopSlug:       string | null;
  shopLogoUrl:    string | null;
  activeListings: number;
  checklist:      ShopHealthChecklist;
  listingsNeedingTitleWork: number;
  topTasks: {
    overdueOrders:     number;
    ordersToSendToday: number;
    helpRequests:      number;
    soldOutListings:   number;
    inactiveListings:  number;
  };
}

interface ShopOwnerHomeProps {
  shopHealth:      ShopHealth;
  revenueThisMonth: number;
  ordersThisMonth:  number;
  storefrontUrl:    string | null;
}

const ACTIVITY_FILTERS = ['All', 'Purchases', 'Reviews', 'Item favourites', 'Shop favourites'] as const;

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function ShopOwnerHome({ shopHealth, revenueThisMonth, ordersThisMonth, storefrontUrl }: ShopOwnerHomeProps) {
  const [tab, setTab] = useState<'home' | 'activity'>('home');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [activityFilter, setActivityFilter] = useState<typeof ACTIVITY_FILTERS[number]>('All');

  const checklistItems: { key: keyof ShopHealthChecklist; label: string; desc?: string; href: string }[] = [
    { key: 'shopName',    label: 'Shop name added',   href: '/settings' },
    { key: 'logo',        label: 'Logo added',        href: '/settings' },
    { key: 'banner',      label: 'Banner added',      href: '/settings' },
    { key: 'story',       label: 'Share your story',  desc: 'Tell buyers about who you are, what inspires you, and how you create', href: '/settings' },
    { key: 'sellerPhoto', label: 'Upload a seller photo', desc: 'Introduce yourself with a friendly, clear photo', href: '/settings' },
  ];
  const doneCount = checklistItems.filter((c) => shopHealth.checklist[c.key]).length;
  const riskFactors = (shopHealth.listingsNeedingTitleWork > 0 ? 1 : 0) + (doneCount < checklistItems.length ? 1 : 0);

  return (
    <>
      {/* ── Greeting header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative w-11 h-11 shrink-0">
          {shopHealth.shopLogoUrl ? (
            <Image src={shopHealth.shopLogoUrl} alt="" width={44} height={44} className="w-11 h-11 rounded-lg object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
              {(shopHealth.shopName ?? 'S')[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-secondary leading-tight truncate">
            {timeGreeting()}, {shopHealth.shopName ?? 'Seller'}
          </h1>
          <p className="text-sm text-muted mt-0.5">
            {shopHealth.activeListings} active listing{shopHealth.activeListings !== 1 ? 's' : ''}
            {storefrontUrl && (
              <>
                {' '}·{' '}
                <a href={storefrontUrl} target="_blank" rel="noopener noreferrer" className="hover:underline inline-flex items-center gap-0.5">
                  view storefront <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── Home / Recent activity tabs ──────────────────────────────────── */}
      <div className="flex items-center gap-6 border-b border-border mb-6">
        {(['home', 'activity'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-secondary text-secondary' : 'border-transparent text-muted hover:text-secondary'
            }`}
          >
            {t === 'home' ? 'Home' : 'Recent activity'}
          </button>
        ))}
      </div>

      {tab === 'home' ? (
        <>
          {riskFactors > 0 && !bannerDismissed && (
            <div className="bg-[#F3F1EC] rounded-card p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <AlertOctagon className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-secondary">
                    {riskFactors} factor{riskFactors !== 1 ? 's' : ''} risk{riskFactors === 1 ? 's' : ''} lowering your search visibility
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    We found some ways you can optimise your listings and shop to help how you show up in search.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setBannerDismissed(true)}
                  className="px-4 py-2 border border-border hover:bg-background text-secondary text-sm font-bold rounded-pill transition-colors"
                >
                  Not now
                </button>
                <Link href="/search-visibility" className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white text-sm font-bold rounded-pill transition-colors">
                  View search visibility
                </Link>
              </div>
            </div>
          )}

          {doneCount < checklistItems.length && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-secondary">Customise your shop</h2>
                  <p className="text-xs text-muted mt-0.5">Showcase your brand&apos;s personality and build trust with buyers</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-20 h-1 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-secondary" style={{ width: `${(doneCount / checklistItems.length) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-muted">{doneCount}/{checklistItems.length}</span>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-card divide-y divide-border overflow-hidden">
                {checklistItems.map((item) => {
                  const done = shopHealth.checklist[item.key];
                  return (
                    <Link key={item.key} href={item.href} className="flex items-start gap-3 px-4 py-3.5 hover:bg-background transition-colors">
                      {done ? (
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-border shrink-0 mt-0.5" strokeDasharray="3 3" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-secondary">{item.label} →</p>
                        {!done && item.desc && <p className="text-xs text-muted mt-0.5">{item.desc}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-8">
            <h2 className="font-display text-lg font-bold text-secondary mb-3">Top tasks</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-surface border border-border rounded-card p-4">
                <p className="text-sm font-bold text-secondary mb-1">Orders</p>
                <p className="text-xs text-muted">{shopHealth.topTasks.overdueOrders} overdue order{shopHealth.topTasks.overdueOrders !== 1 ? 's' : ''}</p>
                <p className="text-xs text-muted">{shopHealth.topTasks.ordersToSendToday} order{shopHealth.topTasks.ordersToSendToday !== 1 ? 's' : ''} to send today</p>
              </div>
              <div className="bg-surface border border-border rounded-card p-4">
                <p className="text-sm font-bold text-secondary mb-1">Messages</p>
                <p className="text-xs text-muted">{shopHealth.topTasks.helpRequests} help request{shopHealth.topTasks.helpRequests !== 1 ? 's' : ''}</p>
              </div>
              <div className="bg-surface border border-border rounded-card p-4">
                <p className="text-sm font-bold text-secondary mb-1">Listings</p>
                <p className="text-xs text-muted">{shopHealth.topTasks.soldOutListings} item{shopHealth.topTasks.soldOutListings !== 1 ? 's' : ''} sold out</p>
                <p className="text-xs text-muted">{shopHealth.topTasks.inactiveListings} listing{shopHealth.topTasks.inactiveListings !== 1 ? 's' : ''} inactive</p>
              </div>
            </div>
            <p className="text-xs text-muted mt-3">Top tasks show activity from the last 30 days.</p>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-lg font-bold text-secondary mb-3">Stats</h2>
            <div className="bg-surface border border-border rounded-card p-5">
              <p className="text-xs font-semibold text-muted mb-4">This month</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-semibold text-secondary">Total Views</p>
                  <p className="text-2xl font-bold text-secondary tabular-nums mt-1">—</p>
                  <p className="text-xs text-muted mt-1">Not tracked yet</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary">Visits</p>
                  <p className="text-2xl font-bold text-secondary tabular-nums mt-1">—</p>
                  <p className="text-xs text-muted mt-1">Not tracked yet</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary">Orders</p>
                  <p className="text-2xl font-bold text-secondary tabular-nums mt-1">{ordersThisMonth}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary">Revenue</p>
                  <p className="text-2xl font-bold text-secondary tabular-nums mt-1">{fmtAmount(revenueThisMonth)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-lg font-bold text-secondary mb-3">Shop advisor</h2>
            <div className="bg-[#F3F1EC] rounded-card py-12 flex flex-col items-center justify-center text-center gap-3">
              <ClipboardCheck className="w-8 h-8 text-muted" />
              <p className="text-sm text-secondary">Nice! There&apos;s nothing you need to do right now.</p>
            </div>
          </div>
        </>
      ) : (
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-6">
            {ACTIVITY_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActivityFilter(f)}
                className={`px-3.5 py-1.5 rounded-pill text-sm font-medium border transition-colors ${
                  activityFilter === f
                    ? 'border-secondary text-secondary bg-background'
                    : 'border-border text-muted hover:bg-background'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="text-center py-16 text-sm text-muted">
            No recent activity to show yet.
          </div>
        </div>
      )}
    </>
  );
}
