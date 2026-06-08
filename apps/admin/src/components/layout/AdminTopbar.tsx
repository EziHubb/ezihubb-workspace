'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Download, ChevronDown, X } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

// ── Page title from pathname ──────────────────────────────────────────────────

const TITLE_MAP: Record<string, string> = {
  '/dashboard':           'Dashboard',
  '/orders':              'Orders',
  '/products':            'Products',
  '/catalog':             'Catalog',
  '/catalog/categories':  'Categories',
  '/catalog/collections': 'Collections',
  '/customers':           'Customers',
  '/promotions':          'Promotions',
  '/reviews':             'Reviews',
  '/shipping':            'Shipping',
  '/payments':            'Payments',
  '/messages':            'Messages',
  '/settings':            'Settings',
};

function getPageTitle(pathname: string): string {
  const match = Object.entries(TITLE_MAP)
    .filter(([k]) => pathname.startsWith(k))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return match?.[1] ?? 'Admin';
}

// ── Date range ────────────────────────────────────────────────────────────────

type DateRange = { from: Date; to: Date; label: string };

function buildPresets(): DateRange[] {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return [
    { label: 'Today',       from: today,              to: today              },
    { label: 'Yesterday',   from: subDays(today, 1),  to: subDays(today, 1)  },
    { label: 'Last 7 days', from: subDays(today, 6),  to: today              },
    { label: 'Last 30 days',from: subDays(today, 29), to: today              },
    { label: 'This month',  from: startOfMonth(today),to: endOfMonth(today)  },
  ];
}

function DateRangePicker() {
  const [open,     setOpen]     = useState(false);
  const [selected, setSelected] = useState<DateRange>(buildPresets()[2]); // Last 7 days
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const fmt = (d: Date) => format(d, 'MMM d');
  const label = selected.from.toDateString() === selected.to.toDateString()
    ? fmt(selected.from)
    : `${fmt(selected.from)} – ${fmt(selected.to)}`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary/40 transition-colors bg-surface"
      >
        {label}
        <ChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-card shadow-floating z-30 py-1 overflow-hidden">
          {buildPresets().map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => { setSelected(preset); setOpen(false); }}
              className={[
                'w-full text-left px-4 py-2 text-sm transition-colors',
                selected.label === preset.label
                  ? 'bg-primary/5 text-primary font-medium'
                  : 'text-secondary hover:bg-muted/5',
              ].join(' ')}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notifications ─────────────────────────────────────────────────────────────

const MOCK_NOTIFICATIONS = [
  { id: 1, text: 'New order #MLH-2026-00341 received',     time: '2m ago',  unread: true  },
  { id: 2, text: '3 reviews pending approval',             time: '15m ago', unread: true  },
  { id: 3, text: 'Low stock: Custom Mug (2 left)',         time: '1h ago',  unread: false },
  { id: 4, text: 'Promo WELCOME10 used 50 times today',   time: '2h ago',  unread: false },
];

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLDivElement>(null);
  const unread          = MOCK_NOTIFICATIONS.filter((n) => n.unread).length;

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        className="relative p-2 hover:bg-muted/10 rounded-full transition-colors"
      >
        <Bell className="w-5 h-5 text-secondary" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 bg-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-surface border border-border rounded-card shadow-floating z-30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm text-secondary">Notifications</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-secondary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="divide-y divide-border max-h-72 overflow-y-auto">
            {MOCK_NOTIFICATIONS.map((n) => (
              <li
                key={n.id}
                className={`px-4 py-3 text-sm hover:bg-muted/5 transition-colors ${n.unread ? 'bg-primary/3' : ''}`}
              >
                <p className={`leading-snug ${n.unread ? 'text-secondary font-medium' : 'text-muted'}`}>
                  {n.text}
                </p>
                <p className="text-xs text-muted mt-0.5">{n.time}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Topbar ─────────────────────────────────────────────────────────────────────

export function AdminTopbar() {
  const pathname = usePathname();
  const title    = getPageTitle(pathname);

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 lg:px-8 shrink-0">
      {/* Left: page title */}
      <h2 className="text-lg font-semibold text-secondary truncate">{title}</h2>

      {/* Right: controls */}
      <div className="flex items-center gap-3">
        <DateRangePicker />

        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary/40 transition-colors bg-surface"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        <NotificationBell />
      </div>
    </header>
  );
}
