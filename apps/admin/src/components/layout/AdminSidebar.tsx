'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import {
  LayoutDashboard, ShoppingCart, ShoppingBag, FolderOpen,
  Tag, Layers, Users, BadgePercent, Star, Truck,
  CreditCard, Settings, ChevronDown, ChevronRight, LogOut, Globe, MessageSquare, Link2,
  Bookmark, Factory, Shield, GitBranch, Store, BarChart2, Wallet, ShieldAlert, History,
  SlidersHorizontal, ScanSearch, Sparkles, TrendingUp, DollarSign, Dna, Activity,
} from 'lucide-react';

// ── Nav item types ─────────────────────────────────────────────────────────────

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
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard',        icon: LayoutDashboard },
  { label: 'Orders',    href: '/orders',            icon: ShoppingCart    },
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
      { label: 'Categories',   href: '/catalog/categories',           icon: Tag      },
      { label: 'Collections',  href: '/catalog/collections',          icon: Layers   },
      { label: 'Tags',         href: '/catalog/tags',                 icon: Tag      },
      { label: 'Sections',     href: '/catalog/shop-sections',        icon: Bookmark },
      { label: 'Partners',     href: '/catalog/production-partners',  icon: Factory  },
    ],
  },
  {
    label: 'Stores', href: '/stores', icon: Store,
    children: [
      { label: 'All Stores',         href: '/stores',              icon: Store    },
      { label: 'Seller Plans',       href: '/stores/plans',        icon: Layers   },
      { label: 'Platform Settings',  href: '/stores/settings',     icon: Settings },
    ],
  },
  { label: 'Finance',     href: '/finance',     icon: BarChart2    },
  { label: 'Payouts',     href: '/payouts',     icon: Wallet       },
  { label: 'Customers',   href: '/customers',   icon: Users        },
  { label: 'Messages',    href: '/messages',    icon: MessageSquare },
  { label: 'Promotions',  href: '/promotions',  icon: BadgePercent  },
  { label: 'Reviews',     href: '/reviews',     icon: Star         },
  { label: 'Shipping',    href: '/shipping',    icon: Truck        },
  { label: 'Payments',    href: '/payments',    icon: CreditCard   },
  {
    label: 'Affiliates', href: '/affiliates', icon: Link2,
    children: [
      { label: 'Applications', href: '/affiliates',         icon: Link2      },
      { label: 'Payouts',      href: '/affiliates/payouts', icon: CreditCard },
      { label: 'Settings',     href: '/settings/affiliates', icon: Settings  },
    ],
  },
  {
    label: 'Creator Network', href: '/creators', icon: GitBranch,
    children: [
      { label: 'Overview', href: '/creators',          icon: GitBranch  },
      { label: 'Members',  href: '/creators/members',  icon: Users      },
      { label: 'Payouts',  href: '/creators/payouts',  icon: CreditCard },
      { label: 'Settings', href: '/creators/settings', icon: Settings   },
    ],
  },
  {
    label: 'AI Features', href: '/ai/trends', icon: Sparkles,
    children: [
      { label: 'Trend Dashboard',   href: '/ai/trends',      icon: TrendingUp, badge: 0 },
      { label: 'Pricing Optimizer', href: '/ai/pricing',     icon: DollarSign            },
      { label: 'Creator DNA',       href: '/ai/creator-dna', icon: Activity              },
      { label: 'AI Usage & Cost',   href: '/ai/usage',       icon: BarChart2             },
      { label: 'AI Settings',       href: '/ai/settings',    icon: Settings              },
    ],
  },
  {
    label: 'Moderation', href: '/moderation', icon: ShieldAlert,
    children: [
      { label: 'Queue',    href: '/moderation/queue',    icon: ShieldAlert        },
      { label: 'History',  href: '/moderation/history',  icon: History            },
      { label: 'IP Scanner', href: '/moderation/ip-scan', icon: ScanSearch        },
      { label: 'Rules',    href: '/moderation/rules',    icon: SlidersHorizontal  },
      { label: 'Settings', href: '/moderation/settings', icon: Settings           },
    ],
  },
  {
    label: 'Settings', href: '/settings', icon: Settings,
    children: [
      { label: 'General',   href: '/settings',           icon: Settings },
      { label: 'Audit Log', href: '/settings/audit-log', icon: Shield   },
    ],
  },
];

// ── Nav row ────────────────────────────────────────────────────────────────────

function NavRow({
  item,
  level = 0,
}: {
  item:   NavItem;
  level?: number;
}) {
  const pathname    = usePathname();
  const hasChildren = !!item.children?.length;

  // Leaf-node active: exact match OR proper sub-path (with "/" separator to avoid prefix collision)
  const isActive = !hasChildren && (
    pathname === item.href ||
    (item.href.length > 1 && pathname.startsWith(item.href + '/'))
  );

  // Parent has an active descendant (used for subtle highlight, NOT full active style)
  const hasActiveChild = hasChildren && !!item.children?.some(
    (c) => pathname === c.href || pathname.startsWith(c.href + '/'),
  );

  // Auto-expand if on a child path
  const [open, setOpen] = useState(() => hasActiveChild);

  // Re-check on pathname changes
  useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [pathname, hasActiveChild]);

  const Icon = item.icon;

  // Leaf rows: full active style with left border
  const leafCls = [
    'flex items-center gap-3 w-full px-3 h-11 rounded-lg text-sm font-medium transition-colors select-none',
    isActive
      ? 'bg-sidebar-active text-white border-l-2 border-primary pl-[10px]'
      : 'text-[#9CA3AF] hover:text-white hover:bg-white/5 border-l-2 border-transparent',
    level > 0 ? 'pl-9' : '',
  ].join(' ');

  // Parent toggle rows: never show active bg — only text brightens when a child is active
  const parentCls = [
    'flex items-center justify-between gap-3 w-full px-3 h-11 rounded-lg text-sm font-medium transition-colors select-none',
    hasActiveChild ? 'text-white hover:bg-white/5' : 'text-[#9CA3AF] hover:text-white hover:bg-white/5',
  ].join(' ');

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={parentCls}
        >
          <span className="flex items-center gap-3">
            <Icon className="w-5 h-5 shrink-0" />
            {item.label}
          </span>
          {open
            ? <ChevronDown className="w-4 h-4 shrink-0" />
            : <ChevronRight className="w-4 h-4 shrink-0" />
          }
        </button>

        {open && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map((child) => (
              <NavRow key={child.href} item={child} level={1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={item.href} className={leafCls}>
      <Icon className="w-5 h-5 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span className="bg-primary text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      )}
    </Link>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function AdminSidebar() {
  const { data: session } = useSession();
  const user = session?.user as Record<string, unknown> | undefined;
  const name  = (user?.['name'] as string) || 'Admin';
  const email = (user?.['email'] as string) || '';
  const initials = name
    .split(' ')
    .map((n) => n[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const { data: pendingData } = useQuery<{ count: number }>({
    queryKey: ['sidebar-affiliate-pending'],
    queryFn:  () => api.get<{ count: number }>(API_ROUTES.ADMIN.AFFILIATES_PENDING_COUNT),
    staleTime:      60_000,
    refetchInterval: 120_000,
  });

  const { data: aiTrendPending } = useQuery<{ count: number }>({
    queryKey: ['sidebar-ai-trend-pending'],
    queryFn:  () => api.get<{ count: number }>(API_ROUTES.ADMIN.AI_TREND_PENDING_COUNT),
    staleTime:       60_000,
    refetchInterval: 120_000,
  });

  const navItems = useMemo(() => NAV_ITEMS.map((item) => {
    if (item.href === '/affiliates') return { ...item, badge: pendingData?.count ?? 0 };
    if (item.label === 'AI Features') {
      return {
        ...item,
        children: item.children?.map((c) =>
          c.href === '/ai/trends' ? { ...c, badge: aiTrendPending?.count ?? 0 } : c,
        ),
      };
    }
    return item;
  }), [pendingData, aiTrendPending]);

  return (
    <aside
      className="hidden lg:flex flex-col w-[240px] shrink-0 h-screen overflow-y-auto"
      style={{ background: '#1E1E2E' }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-base">M</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">Daily Daisy</p>
            <p className="text-[#9CA3AF] text-[11px] leading-none mt-0.5">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 space-y-0.5 mt-2">
        {navItems.map((item) => (
          <NavRow key={item.href} item={item} />
        ))}
      </nav>

      {/* Bottom: user + sign out */}
      <div className="px-4 pb-5 pt-4 border-t border-[#2D2D3E]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">{initials}</span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate leading-none">{name}</p>
            <p className="text-[#9CA3AF] text-xs truncate leading-none mt-0.5">{email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-[#9CA3AF] hover:text-white text-xs transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
