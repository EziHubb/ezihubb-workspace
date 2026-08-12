'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { setStoreContext, useAdminMode } from '../../lib/store-context';
import {
  LayoutDashboard, ShoppingCart, ShoppingBag, FolderOpen,
  Tag, Layers, Users, BadgePercent, Star, Truck,
  CreditCard, Settings, ChevronDown, LogOut, Globe, MessageSquare, Link2,
  Bookmark, Factory, Shield, Store, BarChart2, Wallet, ShieldAlert, History,
  SlidersHorizontal, ScanSearch, TrendingUp,
  Menu, X, Megaphone, Plug, KeyRound, ArrowLeftRight,
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
        label: 'Products', href: '/products', icon: ShoppingBag,
        children: [
          { label: 'All Products', href: '/products',     icon: ShoppingBag },
          { label: 'SEO Audit',    href: '/products/seo', icon: Globe       },
        ],
      },
      {
        label: 'Catalog', href: '/catalog', icon: FolderOpen,
        children: [
          { label: 'Categories',  href: '/catalog/categories',          icon: Tag      },
          { label: 'Collections', href: '/catalog/collections',         icon: Layers   },
          { label: 'Tags',        href: '/catalog/tags',                icon: Tag      },
          { label: 'Sections',    href: '/catalog/shop-sections',       icon: Bookmark },
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
      { label: 'Shipping', href: '/shipping', icon: Truck      },
      { label: 'Payments', href: '/payments', icon: CreditCard },
    ],
  },
  {
    title: 'Community',
    items: [
      // Messages deliberately excluded — they're per-store customer conversations,
      // not something that makes sense aggregated across the whole platform.
      { label: 'Customers',  href: '/customers',  icon: Users         },
      { label: 'Reviews',    href: '/reviews',    icon: Star          },
      { label: 'Promotions', href: '/promotions', icon: BadgePercent  },
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

// ── Navigation structure — ADMIN (shop owner) ─────────────────────────────────
// Shop owners use the SAME routes as super admin — the API scopes data to their store.

function getShopNavSections(storeId: string): NavSection[] {
  const storeHref = storeId ? `/stores/${storeId}` : '/dashboard';
  return [
    {
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        {
          label: 'Stats', href: '/stats', icon: BarChart2,
          children: [
            { label: 'Shop Traffic',         href: '/stats',          icon: TrendingUp },
            { label: 'Marketplace Insights', href: '/stats/listings', icon: BarChart2  },
          ],
        },
      ],
    },
    {
      title: 'Manage',
      items: [
        { label: 'Products', href: '/products', icon: ShoppingBag },
        { label: 'Orders',   href: '/orders',   icon: ShoppingCart },
        { label: 'Reviews',  href: '/reviews',  icon: Star         },
        { label: 'Messages', href: '/messages', icon: MessageSquare },
      ],
    },
    {
      title: 'Finance',
      items: [
        { label: 'Payouts', href: '/payouts', icon: Wallet },
      ],
    },
    {
      title: 'Setup',
      items: [
        {
          label: 'Store Settings', href: storeHref, icon: Settings,
          children: [
            { label: 'General',     href: storeHref,               icon: Settings     },
            { label: 'Shipping',    href: '/shipping',              icon: Truck        },
            { label: 'Promotions',  href: '/promotions',            icon: BadgePercent },
            { label: 'Fulfillment', href: '/settings/fulfillment',  icon: Plug         },
            { label: 'API Keys',    href: '/settings/api-keys',     icon: KeyRound     },
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

  const { role, ownStoreId, canSwitchToOwnStore, inStoreMode, isPlatformContext } = useAdminMode();

  const { data: pendingData } = useQuery<{ count: number }>({
    queryKey: ['sidebar-affiliate-pending'],
    queryFn:  () => api.get<{ count: number }>(API_ROUTES.ADMIN.AFFILIATES_PENDING_COUNT),
    enabled:  isPlatformContext,
    staleTime:       60_000,
    refetchInterval: 120_000,
  });

  const superAdminSections = useMemo<NavSection[]>(() =>
    NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (item.href === '/affiliates') return { ...item, badge: pendingData?.count ?? 0 };
        return item;
      }),
    })),
  [pendingData]);

  const shopNavSections = useMemo(() => getShopNavSections(ownStoreId), [ownStoreId]);
  const navSections = isPlatformContext ? superAdminSections : shopNavSections;

  const toggleStoreMode = () => {
    setStoreContext(inStoreMode ? null : ownStoreId);
    window.location.reload();
  };

  return { name, email, initials, navSections, role, canSwitchToOwnStore, inStoreMode, toggleStoreMode };
}

// ── Child nav row ─────────────────────────────────────────────────────────────

function ChildRow({ item, isActive }: { item: ChildItem; isActive: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={[
        'flex items-center gap-2.5 pl-9 pr-3 h-9 rounded-lg text-xs font-medium transition-all duration-150',
        isActive
          ? 'text-white bg-white/10'
          : 'text-[#6B7280] hover:text-[#D1D5DB] hover:bg-white/5',
      ].join(' ')}
    >
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-80" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="bg-primary/90 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
      {isActive && <span className="w-1 h-1 rounded-full bg-primary shrink-0" />}
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
            hasActiveChild ? 'text-white' : 'text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5',
          ].join(' ')}
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className={[
              'flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all',
              hasActiveChild ? 'bg-white/10' : 'bg-white/5 group-hover:bg-white/8',
            ].join(' ')}>
              <Icon className="w-4 h-4" />
            </span>
            <span className="truncate">{item.label}</span>
          </span>
          <ChevronDown className={[
            'w-3.5 h-3.5 shrink-0 opacity-50 transition-transform duration-200',
            open ? 'rotate-0' : '-rotate-90',
          ].join(' ')} />
        </button>

        {open && (
          <div className="mt-0.5 mb-1 ml-3 pl-3 border-l border-white/[0.08] space-y-0.5">
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
    isLeafActive ? 'bg-primary/20 text-white' : 'text-[#9CA3AF] hover:text-[#E5E7EB] hover:bg-white/5',
  ].join(' ');

  const rowContent = (
    <>
      <span className={[
        'flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-all',
        isLeafActive ? 'bg-primary/30' : 'bg-white/5 group-hover:bg-white/8',
      ].join(' ')}>
        <Icon className="w-4 h-4" />
      </span>
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
        <p className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-[#4B5563] select-none">
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
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
        style={{ background: isShopOwner
          ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
          : 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' }}
      >
        <span className="text-white font-black text-base tracking-tight">
          {isShopOwner ? <Store className="w-5 h-5" /> : 'D'}
        </span>
      </div>
      <div>
        <p className="text-white font-bold text-sm leading-tight tracking-tight">EziHubb</p>
        <p className="text-[10px] font-medium leading-tight mt-0.5 tracking-wide" style={{ color: isShopOwner ? '#6EE7B7' : '#6366F1' }}>
          {isShopOwner ? 'Seller Hub' : 'Admin Panel'}
        </p>
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
            className="w-full flex items-center gap-2 px-3 h-9 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-[#D1D5DB] transition-colors"
            title={inStoreMode ? 'Switch back to the platform-wide view' : 'Switch into your own store, scoped exactly like a shop owner'}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">
              {inStoreMode ? 'Viewing: My Store' : 'Viewing: Platform'}
            </span>
            <span className="text-[10px] font-medium text-[#6B7280]">Switch</span>
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
      <div className="shrink-0 px-3 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)' }}
          >
            <span className="text-white font-bold text-xs">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate leading-tight">{name}</p>
            <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: '#6B7280' }}>{email}</p>
            <span className={[
              'inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5',
              role === 'SUPER_ADMIN' && !inStoreMode ? 'bg-[#7C3AED]/20 text-[#A78BFA]' : 'bg-emerald-500/20 text-emerald-400',
            ].join(' ')}>
              {inStoreMode ? 'Super Admin · My Store' : role === 'SUPER_ADMIN' ? 'Super Admin' : 'Shop Owner'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setStoreContext(null); signOut({ callbackUrl: '/login' }); }}
            className="shrink-0 p-1.5 rounded-lg text-[#6B7280] hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
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
    <aside
      className="hidden lg:flex flex-col w-[248px] shrink-0 h-screen"
      style={{ background: 'linear-gradient(180deg, #16161F 0%, #1A1A26 100%)' }}
    >
      <div className="px-4 pt-5 pb-3">
        <LogoMark role={role} inStoreMode={inStoreMode} />
      </div>
      <div className="mx-4 mb-2 border-t border-white/5" />
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
      <div
        className="lg:hidden flex items-center justify-between px-4 h-14 shrink-0 border-b border-white/5"
        style={{ background: '#16161F' }}
      >
        <LogoMark role={role} inStoreMode={inStoreMode} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Drawer ───────────────────────────────────────────────────────── */}
      <div
        className={[
          'fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] lg:hidden transition-transform duration-300 ease-in-out overflow-hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ background: 'linear-gradient(180deg, #16161F 0%, #1A1A26 100%)' }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 shrink-0">
          <LogoMark role={role} inStoreMode={inStoreMode} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors"
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
