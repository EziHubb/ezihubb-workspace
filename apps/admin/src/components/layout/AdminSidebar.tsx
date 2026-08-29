'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { setStoreContext, useAdminMode } from '../../lib/store-context';
import { useInboxNotifications, isConversationOpen } from '../../lib/realtime';
import { toast } from '../../lib/store/toast.store';
import {
  LayoutDashboard, ShoppingCart, ShoppingBag, FolderOpen,
  Tag, Layers, Users, BadgePercent, Star, Truck,
  CreditCard, Settings, ChevronDown, LogOut, Globe, MessageSquare, Link2,
  Factory, Shield, Store, BarChart2, Wallet, ShieldAlert, History,
  SlidersHorizontal, ScanSearch, TrendingUp,
  Menu, X, Megaphone, Plug, KeyRound, ArrowLeftRight, Landmark, FileText,
  Share2, Gift, Radio, HeartHandshake, Sparkles,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChildItem {
  label:  string;
  href:   string;
  icon:   React.ElementType;
  badge?: number;
}

interface NavItem {
  label:     string;
  href:      string;
  icon:      React.ElementType;
  badge?:    number;
  children?: ChildItem[];
  /** Opens in a new tab as a plain <a> instead of client-side Link routing (e.g. the real GA4 dashboard). */
  external?: boolean;
}

interface NavSection {
  title?: string;
  items:  NavItem[];
}

// Real GA4 property dashboard — set once the account is provisioned; the nav
// link below is simply omitted until then rather than pointing at a dead URL.
const GA_DASHBOARD_URL = process.env['NEXT_PUBLIC_GA_DASHBOARD_URL'];

// ── Navigation structure — SUPER_ADMIN ────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Orders',    href: '/orders',    icon: ShoppingCart    },
      {
        label: 'Stats', href: '/stats', icon: BarChart2,
        children: [
          { label: 'Shop Traffic',         href: '/stats',            icon: TrendingUp },
          { label: 'Marketplace Insights', href: '/stats/listings',   icon: BarChart2  },
        ],
      },
    ],
  },
  {
    title: 'Commerce',
    items: [
      {
        label: 'Listings', href: '/products', icon: ShoppingBag,
        children: [
          { label: 'All Listings', href: '/products',     icon: ShoppingBag },
          { label: 'SEO Audit',    href: '/products/seo', icon: Globe       },
        ],
      },
      {
        label: 'Catalog', href: '/catalog', icon: FolderOpen,
        children: [
          { label: 'Categories',  href: '/catalog/categories',          icon: Tag      },
          { label: 'Collections', href: '/catalog/collections',         icon: Layers   },
          { label: 'Tags',        href: '/catalog/tags',                icon: Tag      },
          { label: 'Partners',    href: '/catalog/production-partners', icon: Factory  },
        ],
      },
      {
        label: 'Stores', href: '/stores', icon: Store,
        children: [
          { label: 'All Stores',        href: '/stores',          icon: Store    },
          { label: 'Platform Settings', href: '/stores/settings', icon: Settings },
        ],
      },
      { label: 'Finance',  href: '/finance',  icon: BarChart2  },
      { label: 'Payouts',  href: '/payouts',  icon: Wallet     },
      { label: 'Payments', href: '/payments', icon: CreditCard },
    ],
  },
  {
    title: 'Community',
    items: [
      // Messages deliberately excluded — they're per-store customer conversations,
      // not something that makes sense aggregated across the whole platform.
      // Promotions deliberately excluded too — there is no platform-wide
      // promotions/coupon feature; the old link here was a dead stub
      // (/promotions just redirected into /marketing/sales, a shop-owner
      // self-service tool). See "Sales and discounts" for the real,
      // SHARED_AGGREGATE-shaped promotions page.
      { label: 'Customers',  href: '/customers',  icon: Users         },
      { label: 'Reviews',    href: '/reviews',    icon: Star          },
      { label: 'Questions',  href: '/questions',  icon: MessageSquare },
      { label: 'Campaigns',  href: '/campaigns',  icon: Megaphone     },
    ],
  },
  {
    title: 'Growth',
    items: [
      {
        label: 'Affiliates', href: '/affiliates', icon: Link2,
        children: [
          { label: 'Applications', href: '/affiliates',          icon: Link2      },
          { label: 'Payouts',      href: '/affiliates/payouts',  icon: CreditCard },
          { label: 'Settings',     href: '/settings/affiliates', icon: Settings   },
        ],
      },
      ...(GA_DASHBOARD_URL
        ? [{ label: 'Google Analytics', href: GA_DASHBOARD_URL, icon: BarChart2, external: true }]
        : []),
    ],
  },
  {
    title: 'System',
    items: [
      {
        label: 'Moderation', href: '/moderation', icon: ShieldAlert,
        children: [
          { label: 'Queue',      href: '/moderation/queue',    icon: ShieldAlert       },
          { label: 'History',    href: '/moderation/history',  icon: History           },
          { label: 'IP Scanner', href: '/moderation/ip-scan',  icon: ScanSearch        },
          { label: 'Rules',      href: '/moderation/rules',    icon: SlidersHorizontal },
          { label: 'Settings',   href: '/moderation/settings', icon: Settings          },
        ],
      },
      {
        label: 'Settings', href: '/settings', icon: Settings,
        children: [
          { label: 'General',     href: '/settings',              icon: Settings },
          { label: 'Fulfillment', href: '/settings/fulfillment',  icon: Plug     },
          { label: 'API Keys',    href: '/settings/api-keys',     icon: KeyRound },
          { label: 'Audit Log',   href: '/settings/audit-log',    icon: Shield   },
        ],
      },
    ],
  },
];

// ── Navigation structure — shop-owner context ─────────────────────────────────
// Shop owners use the SAME routes as super admin — the API scopes data to their store.
//
// This function is only ever consumed in the `!isPlatformContext` branch (see
// useNavData), i.e. by whoever is currently ACTING as a shop owner: a plain
// ADMIN, or a SUPER_ADMIN who switched into "My Store" for the store they
// personally own. Everything it returns is therefore shop-owner nav by
// definition — do NOT re-filter it by `role` inside. An earlier version gated
// the "Store Settings" section on `role === 'ADMIN'`, which contradicted the
// whole point of My Store mode and left a SUPER_ADMIN who owns a store with
// no route at all to edit their own Shop Home (/stores/[id] only edits
// name/description + approve/reject/suspend — it has no Shop Home editor).
//
// The platform-context requirement is unchanged and enforced ELSEWHERE, by the
// isPlatformContext branch itself: a SUPER_ADMIN administering the marketplace
// gets NAV_SECTIONS and never sees this section.

/**
 * The seller's navigation, as one flat list.
 *
 * Order follows the reference shop manager: Dashboard, Listings, Messages,
 * Orders, Search visibility, Stats, Customer service stats, Policy
 * violations, Marketing, Finances, Settings. Store Settings is "Settings"
 * there; the three entries we have no equivalent for (Search, Apps, Help)
 * are simply absent rather than stubbed.
 *
 * The nav reads "Listings", which is also the heading the products page
 * itself already rendered — the two had disagreed, so the tab and the page
 * it opened were named different things.
 *
 * No group headings. They were Manage / Marketing / Finance / Setup, and two
 * of the four labelled a single item — a heading over one row is a divider
 * with extra words. A seller scanning for "Orders" reads eleven labels either
 * way; the headings only made the column taller.
 *
 * Reviews is ours alone — the reference has no top-level equivalent. Placed
 * beside Customer service stats because both are the buyer's verdict on the
 * shop, rather than wedged into the order-management run above it.
 */
function getShopNavSections(): NavSection[] {
  return [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Listings',   href: '/products',  icon: ShoppingBag     },
        { label: 'Messages',  href: '/messages',  icon: MessageSquare   },
        { label: 'Orders',    href: '/orders',    icon: ShoppingCart    },
        { label: 'Search visibility', href: '/search-visibility', icon: ScanSearch },
        {
          label: 'Stats', href: '/stats', icon: BarChart2,
          children: [
            { label: 'Shop Traffic',         href: '/stats',          icon: TrendingUp },
            { label: 'Marketplace Insights', href: '/stats/listings', icon: BarChart2  },
          ],
        },
        { label: 'Customer service stats', href: '/customer-service-stats', icon: HeartHandshake },
        { label: 'Reviews',                href: '/reviews',                icon: Star           },
        { label: 'Questions',              href: '/questions',              icon: MessageSquare },
        { label: 'Policy violations',      href: '/policy-violations',      icon: ShieldAlert    },
        {
          label: 'Marketing', href: '/marketing/sales', icon: Megaphone,
          children: [
            { label: 'Sales and discounts', href: '/marketing/sales',       icon: BadgePercent },
            { label: 'Social media',        href: '/marketing/social',      icon: Share2       },
            { label: 'Share & Save',        href: '/marketing/share-save',  icon: Gift         },
            { label: 'Offsite Ads',         href: '/marketing/offsite-ads', icon: Radio        },
          ],
        },
        {
          label: 'Finances', href: '/finances', icon: Wallet,
          children: [
            { label: 'Payment account',           href: '/finances',                  icon: Landmark   },
            { label: 'Monthly statements',        href: '/finances/statements',       icon: History    },
            { label: 'Payment settings',          href: '/finances/payment-settings', icon: CreditCard },
            { label: 'Legal and tax information', href: '/finances/tax-information',  icon: FileText   },
          ],
        },
        {
          label: 'Store Settings', href: '/settings/shop-home', icon: Settings,
          children: [
            { label: 'Shop Home',    href: '/settings/shop-home',   icon: Store    },
            { label: 'Delivery',     href: '/settings/delivery',    icon: Truck    },
            { label: 'Fulfillment',  href: '/settings/fulfillment', icon: Plug     },
            { label: 'API Keys',     href: '/settings/api-keys',    icon: KeyRound },
            { label: 'Ezihubb Plus', href: '/settings/plus',        icon: Sparkles },
          ],
        },
      ],
    },
  ];
}

// ── Shared data hook ──────────────────────────────────────────────────────────

function useNavData() {
  const { data: session } = useSession();
  const user     = session?.user as Record<string, unknown> | undefined;
  const name     = (user?.['name']  as string) || 'Admin';
  const email    = (user?.['email'] as string) || '';
  const initials = name.split(' ').map((n) => n[0] ?? '').slice(0, 2).join('').toUpperCase();

  const { role, ownStoreId, canSwitchToOwnStore, inStoreMode, isPlatformContext, isReady } = useAdminMode();
  const qc = useQueryClient();

  const { data: pendingData } = useQuery<{ count: number }>({
    queryKey: ['sidebar-affiliate-pending'],
    queryFn:  () => api.get<{ count: number }>(API_ROUTES.ADMIN.AFFILIATES_PENDING_COUNT),
    enabled:  isPlatformContext,
    staleTime:       60_000,
    refetchInterval: 120_000,
  });

  const { data: unansweredQuestions } = useQuery<{ count: number }>({
    queryKey: ['sidebar-questions-unanswered'],
    queryFn:  () => api.get<{ count: number }>(API_ROUTES.ADMIN.QUESTIONS_UNANSWERED),
    enabled:  isReady,
    staleTime:       60_000,
    refetchInterval: 120_000,
  });

  const superAdminSections = useMemo<NavSection[]>(() =>
    NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (item.href === '/affiliates') return { ...item, badge: pendingData?.count ?? 0 };
        if (item.href === '/questions') return { ...item, badge: unansweredQuestions?.count ?? 0 };
        return item;
      }),
    })),
  [pendingData, unansweredQuestions]);

  /**
   * The counts beside Orders and Messages in the shop-owner nav.
   *
   * One request rather than reusing the inbox's folder endpoint, which answers
   * ten folders with ten COUNTs — this renders on every page and polls.
   *
   * Only while acting as a shop owner: the endpoint requires a store, so a
   * platform-context SUPER_ADMIN would get a 400 on every page load, and
   * there is no one store whose unread count would mean anything to them.
   */
  const { data: badges } = useQuery<{ unreadMessages: number; ordersToProcess: number }>({
    queryKey: ['sidebar-nav-badges'],
    queryFn:  () => api.get<{ unreadMessages: number; ordersToProcess: number }>(
      API_ROUTES.ADMIN.DASHBOARD_NAV_BADGES,
    ),
    enabled:  isReady && !isPlatformContext,
    staleTime:       60_000,
    refetchInterval: 120_000,
  });

  /**
   * A customer wrote — say so, and refresh the badge now rather than on the
   * next poll.
   *
   * The sidebar is the right place for both: it is mounted on every page, so
   * a seller working on listings still hears about a message, and it already
   * owns the badge query this invalidates.
   */
  useInboxNotifications((payload) => {
    qc.invalidateQueries({ queryKey: ['sidebar-nav-badges'] });
    // The inbox's own queries too, so a seller sitting on the Messages page
    // sees the list move rather than only the number beside it.
    qc.invalidateQueries({ queryKey: ['messages-list'] });
    qc.invalidateQueries({ queryKey: ['message-folders'] });

    // The refreshes above run either way — the counts are wrong the moment
    // the message lands. The toast is only for a message the seller cannot
    // already see: announcing one they are reading is noise, and noise is how
    // a notification stops being read at all.
    if (!isConversationOpen(payload.conversationId)) {
      toast.info(`${payload.from}: ${payload.preview}`, {
        avatarUrl:  payload.avatarUrl ?? null,
        avatarName: payload.from,
      });
    }
  });

  // No longer role-dependent: this branch only renders for someone already
  // acting as a shop owner (see getShopNavSections' own note).
  const shopNavSections = useMemo(() => {
    const sections = getShopNavSections();
    // Rebuilt rather than mutated: getShopNavSections returns fresh objects,
    // but writing into them would still make the badge depend on the order
    // React happened to render in.
    return sections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (item.href === '/orders' && badges)   return { ...item, badge: badges.ordersToProcess };
        if (item.href === '/messages' && badges) return { ...item, badge: badges.unreadMessages };
        if (item.href === '/questions') return { ...item, badge: unansweredQuestions?.count ?? 0 };
        return item;
      }),
    }));
  }, [badges, unansweredQuestions]);
  // While the session is still loading, `role` is '' (see useAdminMode) — which
  // is neither 'SUPER_ADMIN' nor 'ADMIN', so isPlatformContext computes false
  // and a SUPER_ADMIN would briefly render the shop-owner nav before snapping
  // to the platform one. Render nothing until the role is actually known — the
  // sidebar shell, logo and user block still render, only the role-dependent
  // item list waits.
  const navSections = !isReady
    ? []
    : isPlatformContext ? superAdminSections : shopNavSections;

  const toggleStoreMode = () => {
    setStoreContext(inStoreMode ? null : ownStoreId);
    // A full navigation is intentional: the dashboard and layout read the
    // store-context cookie on the server. Replacing the current entry also
    // prevents Back from reopening a route that may not belong to the newly
    // selected account context.
    window.location.replace('/dashboard');
  };

  return { name, email, initials, navSections, role, canSwitchToOwnStore, inStoreMode, toggleStoreMode };
}

// ── Child nav row ─────────────────────────────────────────────────────────────
// Etsy's Shop Manager nav is flat text on a light sidebar — no boxed icon
// backgrounds. Active state is a soft tint (theme-primary at low alpha, see
// `sidebar-active` in apps/admin/tailwind.config.js) rather than a colored fill.

function ChildRow({ item, isActive }: { item: ChildItem; isActive: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={[
        'flex items-center gap-2.5 pl-9 pr-3 h-9 rounded-lg text-xs font-medium transition-all duration-150',
        isActive
          ? 'text-secondary font-semibold bg-sidebar-active'
          : 'text-muted hover:text-secondary hover:bg-black/[0.03]',
      ].join(' ')}
    >
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-70" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="bg-primary text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Nav row ───────────────────────────────────────────────────────────────────

function NavRow({ item }: { item: NavItem }) {
  const pathname    = usePathname();
  const hasChildren = !!item.children?.length;

  const isLeafActive = !hasChildren && (
    pathname === item.href || (item.href.length > 1 && pathname.startsWith(item.href + '/'))
  );
  const hasActiveChild = hasChildren && !!item.children?.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + '/'),
  );

  // Most-specific match wins: exact first, then longest prefix — prevents siblings from both activating
  const activeChildHref = (() => {
    const children = item.children ?? [];
    const exact = children.find((c) => pathname === c.href);
    if (exact) return exact.href;
    const prefixMatches = children.filter((c) => c.href.length > 1 && pathname.startsWith(c.href + '/'));
    if (!prefixMatches.length) return null;
    return prefixMatches.reduce((a, b) => (a.href.length >= b.href.length ? a : b)).href;
  })();

  const [open, setOpen] = useState(() => hasActiveChild);
  useEffect(() => { if (hasActiveChild) setOpen(true); }, [pathname, hasActiveChild]);

  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={[
            'group flex items-center justify-between w-full px-3 h-10 rounded-xl text-sm font-medium transition-all duration-150 select-none',
            hasActiveChild ? 'text-secondary font-semibold' : 'text-muted hover:text-secondary hover:bg-black/[0.03]',
          ].join(' ')}
        >
          <span className="flex items-center gap-3 min-w-0">
            <Icon className="w-4 h-4 shrink-0 opacity-80" />
            <span className="truncate">{item.label}</span>
          </span>
          <ChevronDown className={[
            'w-3.5 h-3.5 shrink-0 opacity-50 transition-transform duration-200',
            open ? 'rotate-0' : '-rotate-90',
          ].join(' ')} />
        </button>

        {open && (
          <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-border space-y-0.5">
            {item.children!.map((child) => (
              <ChildRow key={child.href} item={child} isActive={child.href === activeChildHref} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const rowClassName = [
    'group flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-all duration-150 select-none',
    isLeafActive ? 'bg-sidebar-active text-secondary font-semibold' : 'text-muted hover:text-secondary hover:bg-black/[0.03]',
  ].join(' ');

  const rowContent = (
    <>
      <Icon className="w-4 h-4 shrink-0 opacity-80" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={rowClassName}>
        {rowContent}
      </a>
    );
  }

  return (
    <Link href={item.href} className={rowClassName}>
      {rowContent}
    </Link>
  );
}

// ── Nav section ───────────────────────────────────────────────────────────────

function NavSectionGroup({ section }: { section: NavSection }) {
  return (
    <div className="space-y-0.5">
      {section.title && (
        <p className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-muted select-none">
          {section.title}
        </p>
      )}
      {section.items.map((item) => (
        <NavRow key={item.href} item={item} />
      ))}
    </div>
  );
}

// ── Logo mark ─────────────────────────────────────────────────────────────────

function LogoMark({ role, inStoreMode }: { role?: string; inStoreMode?: boolean }) {
  const isShopOwner = role === 'ADMIN' || !!inStoreMode;
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
        style={{ background: isShopOwner
          ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
          : 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' }}
      >
        <span className="text-white font-black text-base tracking-tight">
          {isShopOwner ? <Store className="w-5 h-5" /> : 'D'}
        </span>
      </div>
      <div>
        <p className="text-secondary font-bold text-sm leading-tight tracking-tight">EziHubb</p>
        <p className="text-[10px] font-semibold leading-tight mt-0.5 tracking-wide" style={{ color: isShopOwner ? '#059669' : '#4F46E5' }}>
          {isShopOwner ? 'Seller Hub' : 'Admin Panel'}
        </p>
        {/* Build version — SUPER_ADMIN only (incl. while switched into their
            own store), so support can confirm which release is actually live
            without SSHing into the server. Semantic X.Y.Z, auto-computed by
            scripts/compute-version.sh from Conventional Commits since the
            last vX.Y.Z tag — never hand-edited (see CLAUDE.md). */}
        {role === 'SUPER_ADMIN' && (
          <p className="text-[10px] font-mono font-semibold leading-tight mt-0.5 text-muted" title="Build version">
            v{process.env.NEXT_PUBLIC_BUILD_VERSION ?? 'dev'}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Shared nav body (used in both desktop sidebar + mobile drawer) ─────────────

function SidebarBody({
  navSections,
  name,
  email,
  initials,
  role,
  canSwitchToOwnStore,
  inStoreMode,
  toggleStoreMode,
}: {
  navSections: NavSection[];
  name:        string;
  email:       string;
  initials:    string;
  role?:       string;
  canSwitchToOwnStore?: boolean;
  inStoreMode?:         boolean;
  toggleStoreMode?:     () => void;
}) {
  return (
    <>
      {/* Store-context switcher — only for a SUPER_ADMIN who also owns a store */}
      {canSwitchToOwnStore && (
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={toggleStoreMode}
            className="w-full flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold bg-black/[0.03] hover:bg-black/[0.06] border border-border text-secondary transition-colors"
            title={inStoreMode ? 'Switch back to the platform-wide view' : 'Switch into your own store, scoped exactly like a shop owner'}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">
              {inStoreMode ? 'Viewing: My Store' : 'Viewing: Platform'}
            </span>
            <span className="text-[10px] font-medium text-muted">Switch</span>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 pb-2 space-y-0.5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {navSections.map((section, i) => (
          <NavSectionGroup key={i} section={section} />
        ))}
      </nav>

      {/* User footer */}
      <div className="shrink-0 px-3 py-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' }}
          >
            <span className="text-white font-bold text-xs">{initials}</span>
          </div>
          {/* The name block is the way in to /account — password and
              sessions. A nav entry of its own would have to live in either
              the platform list or the shop list, and it belongs to neither:
              it is about the person signed in, not about what they are
              currently looking at. Beside their own name is where someone
              looks for it. */}
          <Link
            href="/account"
            title="Your account"
            className="min-w-0 flex-1 rounded-lg px-1 py-0.5 -mx-1 hover:bg-black/[0.04] transition-colors"
          >
            <p className="text-secondary text-xs font-semibold truncate leading-tight">{name}</p>
            <p className="text-muted text-[11px] truncate leading-tight mt-0.5">{email}</p>
            <span className={[
              'inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5',
              role === 'SUPER_ADMIN' && !inStoreMode ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700',
            ].join(' ')}>
              {inStoreMode ? 'Super Admin · My Store' : role === 'SUPER_ADMIN' ? 'Super Admin' : 'Shop Owner'}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => { setStoreContext(null); signOut({ callbackUrl: '/login' }); }}
            className="shrink-0 p-1.5 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-all duration-150"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Desktop sidebar ───────────────────────────────────────────────────────────

export function AdminSidebar() {
  const { name, email, initials, navSections, role, canSwitchToOwnStore, inStoreMode, toggleStoreMode } = useNavData();

  return (
    <aside className="hidden h-full w-[248px] shrink-0 flex-col border-r border-border bg-background lg:flex">
      <div className="px-4 pt-5 pb-3">
        <LogoMark role={role} inStoreMode={inStoreMode} />
      </div>
      <div className="mx-4 mb-2 border-t border-border" />
      <SidebarBody
        navSections={navSections}
        name={name}
        email={email}
        initials={initials}
        role={role}
        canSwitchToOwnStore={canSwitchToOwnStore}
        inStoreMode={inStoreMode}
        toggleStoreMode={toggleStoreMode}
      />
    </aside>
  );
}

// ── Mobile top bar + drawer ───────────────────────────────────────────────────

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { name, email, initials, navSections, role, canSwitchToOwnStore, inStoreMode, toggleStoreMode } = useNavData();

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <div className="lg:hidden flex items-center justify-between px-4 h-14 shrink-0 bg-background border-b border-border">
        <LogoMark role={role} inStoreMode={inStoreMode} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 rounded-xl text-muted hover:text-secondary hover:bg-black/[0.04] transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Drawer ───────────────────────────────────────────────────────── */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] lg:hidden transition-transform duration-300 ease-in-out overflow-hidden',
          'bg-background',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <LogoMark role={role} inStoreMode={inStoreMode} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl text-muted hover:text-secondary hover:bg-black/[0.04] transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer body — same nav content */}
        <SidebarBody
          navSections={navSections}
          name={name}
          email={email}
          initials={initials}
          role={role}
          canSwitchToOwnStore={canSwitchToOwnStore}
          inStoreMode={inStoreMode}
          toggleStoreMode={toggleStoreMode}
        />
      </div>
    </>
  );
}
