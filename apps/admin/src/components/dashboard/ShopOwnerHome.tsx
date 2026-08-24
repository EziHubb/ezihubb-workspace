'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertOctagon, CheckCircle2, Circle, Clock, ExternalLink, ClipboardCheck,
} from 'lucide-react';
import { fmtAmount } from '../../lib/fmt';

interface ShopHealthChecklist {
  shopName:    boolean;
  logo:        boolean;
  banner:      boolean;
  story:       boolean;
  sellerPhoto: boolean;
}

/**
 * What decides whether the shop can transact, as opposed to how it looks.
 *
 * Kept apart from ShopHealthChecklist on purpose: the two are rendered as
 * different sections, and folding them together would put "add a banner"
 * beside "you have no delivery profile so checkout cannot quote a price".
 */
interface ShopSetupSteps {
  firstListing:      boolean;
  deliveryProfile:   boolean;
  processingProfile: boolean;
  shopSection:       boolean;
}

interface ShopHealth {
  shopName:       string | null;
  shopSlug:       string | null;
  shopLogoUrl:    string | null;
  activeListings: number;
  checklist:      ShopHealthChecklist;
  setup:          ShopSetupSteps;
  shopApproved:   boolean;
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

  /**
   * All five pointed at `/settings`, which is the PLATFORM settings page —
   * SMTP, email templates, admin accounts, flush-the-cache. Its "Store Logo"
   * and "Shop Banner" fields belong to the marketplace, not to this shop, so
   * a seller following "Logo added" was sent to change the wrong site's logo
   * and every request they made there would 403.
   *
   * The seller's own shop page is /settings/shop-home, which is where the
   * name, logo, banner and story actually live.
   */
  const checklistItems: { key: keyof ShopHealthChecklist; label: string; desc?: string; href: string; external?: boolean }[] = [
    { key: 'shopName',    label: 'Shop name added',   href: '/settings/shop-home' },
    { key: 'logo',        label: 'Logo added',        href: '/settings/shop-home' },
    { key: 'banner',      label: 'Banner added',      href: '/settings/shop-home' },
    { key: 'story',       label: 'Share your story',  desc: 'Tell buyers about who you are, what inspires you, and how you create', href: '/settings/shop-home' },
    // The seller photo is the USER's avatar, not a shop field, and nothing in
    // this app edits it — the only page that uploads it is the storefront
    // account profile. Linked across rather than left pointing at a page that
    // cannot change it.
    {
      key: 'sellerPhoto', label: 'Upload a seller photo', external: true,
      desc: 'Introduce yourself with a friendly, clear photo',
      href: `${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3000'}/account/profile`,
    },
  ];
  const doneCount = checklistItems.filter((c) => shopHealth.checklist[c.key]).length;
  const riskFactors = (shopHealth.listingsNeedingTitleWork > 0 ? 1 : 0) + (doneCount < checklistItems.length ? 1 : 0);

  /**
   * Ordered by what blocks a sale hardest, not by how easy it is.
   *
   * Delivery comes before the first listing because a listing published
   * without a profile cannot be quoted at checkout — telling the seller to
   * publish first sends them back to edit every listing afterwards.
   *
   * `blocking` marks a step that stops money changing hands. Shop sections
   * are organisation, so the guide asks for them without claiming the shop is
   * broken until they exist.
   */
  const setupSteps: {
    key: keyof ShopSetupSteps; label: string; desc: string; href: string; blocking: boolean;
  }[] = [
    {
      key: 'deliveryProfile', blocking: true, href: '/settings/delivery',
      label: 'Set up delivery',
      desc:  'Checkout needs a delivery profile before it can quote a shipping price for your items',
    },
    {
      key: 'processingProfile', blocking: true, href: '/settings/delivery',
      label: 'Set your processing time',
      desc:  'How long you take to make and dispatch an order — buyers see this as a delivery estimate',
    },
    {
      key: 'firstListing', blocking: true, href: '/products/new',
      label: 'Publish your first listing',
      desc:  'Nothing can be bought until at least one listing is active',
    },
    {
      // /catalog/shop-sections is the PLATFORM catalog tool — /catalog is
      // PLATFORM_ONLY in route-categories. Sellers manage their own sections
      // from the Add/Manage section modals on shop-home.
      key: 'shopSection', blocking: false, href: '/settings/shop-home',
      label: 'Group items into shop sections',
      desc:  'Optional, but it gives shoppers a way to browse once you have more than a handful of items',
    },
  ];
  const setupDone     = setupSteps.filter((s) => shopHealth.setup[s.key]).length;
  const blockersLeft  = setupSteps.filter((s) => s.blocking && !shopHealth.setup[s.key]).length;
  // "Nothing to do" has to mean both lists, or the advisor congratulates a
  // seller who still has an empty shop page.
  const allSettled    = setupDone === setupSteps.length && doneCount === checklistItems.length;

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
                  const rowClass = 'flex items-start gap-3 px-4 py-3.5 hover:bg-background transition-colors';
                  const inner = (
                    <>
                      {done ? (
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-border shrink-0 mt-0.5" strokeDasharray="3 3" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-secondary">
                          {item.label} {item.external ? <ExternalLink className="inline w-3.5 h-3.5 align-text-top" /> : '→'}
                        </p>
                        {!done && item.desc && <p className="text-xs text-muted mt-0.5">{item.desc}</p>}
                      </div>
                    </>
                  );

                  // A plain anchor for the storefront: next/link would render
                  // one anyway for an absolute URL, but without the new tab or
                  // the noopener that sending someone to another origin needs.
                  return item.external ? (
                    <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" className={rowClass}>
                      {inner}
                    </a>
                  ) : (
                    <Link key={item.key} href={item.href} className={rowClass}>
                      {inner}
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

          {/* ── Shop advisor ───────────────────────────────────────────────
              This used to render the "nothing to do" panel unconditionally —
              it congratulated a brand-new shop that had no listing, no
              delivery profile and no way to take an order. The steps below
              are read from the same tables the checkout reads, so the advice
              cannot drift from what actually blocks a sale. */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-secondary">Shop advisor</h2>
                {!allSettled && (
                  <p className="text-xs text-muted mt-0.5">
                    {blockersLeft > 0
                      ? `${blockersLeft} thing${blockersLeft !== 1 ? 's' : ''} still stop${blockersLeft === 1 ? 's' : ''} your shop taking an order`
                      : 'Your shop can take orders. A couple of finishing touches left.'}
                  </p>
                )}
              </div>
              {!allSettled && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-20 h-1 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-secondary" style={{ width: `${(setupDone / setupSteps.length) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-muted">{setupDone}/{setupSteps.length}</span>
                </div>
              )}
            </div>

            {/* Reported, never ticked: approval is not something the seller
                can go and do, so it is stated rather than assigned. */}
            {!shopHealth.shopApproved && (
              <div className="mb-3 flex items-start gap-3 rounded-card border border-warning/30 bg-warning/5 px-4 py-3">
                <Clock className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-secondary">Your shop is still being reviewed</p>
                  <p className="text-xs text-muted mt-0.5">
                    Buyers cannot order yet. Getting the steps below done now means you can sell the moment it is approved.
                  </p>
                </div>
              </div>
            )}

            {allSettled ? (
              <div className="bg-[#F3F1EC] rounded-card py-12 flex flex-col items-center justify-center text-center gap-3">
                <ClipboardCheck className="w-8 h-8 text-muted" />
                <p className="text-sm text-secondary">Nice! There&apos;s nothing you need to do right now.</p>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-card divide-y divide-border overflow-hidden">
                {setupSteps.map((step) => {
                  const done = shopHealth.setup[step.key];
                  return (
                    <Link
                      key={step.key}
                      href={step.href}
                      className="flex items-start gap-3 px-4 py-3.5 hover:bg-background transition-colors"
                    >
                      {done ? (
                        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-border shrink-0 mt-0.5" strokeDasharray="3 3" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-secondary">
                          {step.label} →
                          {!done && step.blocking && (
                            <span className="ml-2 rounded-pill bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning align-middle">
                              Blocks orders
                            </span>
                          )}
                        </p>
                        {!done && <p className="text-xs text-muted mt-0.5">{step.desc}</p>}
                      </div>
                    </Link>
                  );
                })}

                {/* Pointed at rather than repeated: these five have their own
                    section above, and listing them twice would read as ten
                    outstanding tasks when there are only five. */}
                {doneCount < checklistItems.length && (
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <Circle className="w-5 h-5 text-border shrink-0 mt-0.5" strokeDasharray="3 3" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-secondary">
                        Finish customising your shop ({doneCount}/{checklistItems.length})
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        The shop page buyers land on is still missing a few things — see the section above.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
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
