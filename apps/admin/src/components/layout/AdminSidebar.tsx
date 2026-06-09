'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { clientFetch } from '../../lib/api';
import {
  LayoutDashboard, ShoppingCart, ShoppingBag, FolderOpen,
  Tag, Layers, Users, BadgePercent, Star, Truck,
  CreditCard, Settings, ChevronDown, ChevronRight, LogOut, Globe, MessageSquare, Link2,
} from 'lucide-react';

// ── Nav item types ─────────────────────────────────────────────────────────────

interface NavItem {
  label:    string;
  href:     string;
  icon:     React.ElementType;
  badge?:   number;
  children?: { label: string; href: string; icon: React.ElementType }[];
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
      { label: 'Categories',  href: '/catalog/categories',  icon: Tag    },
      { label: 'Collections', href: '/catalog/collections', icon: Layers },
    ],
  },
  { label: 'Customers',   href: '/customers',   icon: Users         },
  { label: 'Messages',    href: '/messages',    icon: MessageSquare },
  { label: 'Promotions',  href: '/promotions',  icon: BadgePercent  },
  { label: 'Reviews',     href: '/reviews',     icon: Star         },
  { label: 'Shipping',    href: '/shipping',    icon: Truck        },
  { label: 'Payments',    href: '/payments',    icon: CreditCard   },
  {
    label: 'Affiliates', href: '/affiliates', icon: Link2,
    children: [
      { label: 'Applications', href: '/affiliates',        icon: Link2        },
      { label: 'Payouts',      href: '/affiliates/payouts', icon: CreditCard   },
      { label: 'Settings',     href: '/settings/affiliates', icon: Settings    },
    ],
  },
  { label: 'Settings',    href: '/settings',    icon: Settings     },
];

// ── Nav row ────────────────────────────────────────────────────────────────────

function NavRow({
  item,
  level = 0,
}: {
  item:   NavItem;
  level?: number;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href));
  const hasChildren = !!item.children?.length;

  // Auto-expand if on a child path
  const [open, setOpen] = useState(() =>
    !!item.children?.some((c) => pathname.startsWith(c.href)),
  );

  // Re-check on pathname changes
  useEffect(() => {
    if (item.children?.some((c) => pathname.startsWith(c.href))) setOpen(true);
  }, [pathname, item.children]);

  const Icon = item.icon;

  const rowCls = [
    'flex items-center gap-3 w-full px-3 h-11 rounded-lg text-sm font-medium transition-colors select-none',
    isActive
      ? 'bg-sidebar-active text-white border-l-2 border-primary pl-[10px]'
      : 'text-[#9CA3AF] hover:text-white hover:bg-white/5 border-l-2 border-transparent',
    level > 0 ? 'pl-9' : '',
  ].join(' ');

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={rowCls + ' justify-between'}
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
    <Link href={item.href} className={rowCls}>
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
    queryFn:  async () => {
      const res  = await clientFetch('/admin/affiliates/pending-count');
      const body = await res.json();
      return (body.data ?? body) as { count: number };
    },
    staleTime:      60_000,
    refetchInterval: 120_000,
  });

  const navItems = useMemo(() => NAV_ITEMS.map((item) =>
    item.href === '/affiliates'
      ? { ...item, badge: pendingData?.count ?? 0 }
      : item,
  ), [pendingData]);

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
            <p className="text-white font-bold text-sm leading-none">MapleLoom</p>
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
