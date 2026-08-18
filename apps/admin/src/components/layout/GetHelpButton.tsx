'use client';

import Link from 'next/link';
import { HelpCircle, LifeBuoy, ShieldAlert, ScanSearch } from 'lucide-react';
import { Popover } from '@ezihubb/ui';
import { useAdminMode } from '../../lib/store-context';

const LINKS = [
  { label: 'Search visibility',        href: '/search-visibility',       icon: ScanSearch },
  { label: 'Customer service stats',   href: '/customer-service-stats',  icon: LifeBuoy },
  { label: 'Policy violations',        href: '/policy-violations',       icon: ShieldAlert },
];

/**
 * Persistent floating help entry point, visible on every admin page —
 * matches Etsy's Shop Manager black pill "Help" button fixed bottom-right.
 */
export function GetHelpButton() {
  // These 3 pages are scoped to one store with no platform-wide view — hide
  // them for a SUPER_ADMIN who hasn't switched into a store (the layout
  // guard would just bounce them back to /dashboard anyway).
  const { isPlatformContext, isReady } = useAdminMode();
  // Same guard as AdminSidebar's navSections: until the session resolves,
  // `role` is '' so isPlatformContext computes false — the shop-owner value —
  // and a SUPER_ADMIN would briefly be offered shop-owner help links. Show no
  // links until the role is actually known.
  const links = !isReady || isPlatformContext ? [] : LINKS;

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <Popover
        placement="top-end"
        width="16rem"
        trigger={
          <span className="inline-flex items-center gap-2 bg-secondary text-white text-sm font-bold rounded-pill px-4 py-3 shadow-floating hover:opacity-90 transition-opacity">
            <HelpCircle className="w-4 h-4" />
            Get Help
          </span>
        }
      >
        <p className="text-sm font-bold text-secondary mb-2">How can we help?</p>
        {links.length > 0 && (
          <div className="space-y-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-secondary hover:bg-black/[0.03] transition-colors"
              >
                <l.icon className="w-4 h-4 text-muted shrink-0" />
                {l.label}
              </Link>
            ))}
          </div>
        )}
        <div className={links.length > 0 ? 'mt-2 pt-2 border-t border-border' : ''}>
          <a
            href="mailto:support@ezihubb.com"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-semibold text-secondary hover:bg-black/[0.03] transition-colors"
          >
            Contact support
          </a>
        </div>
      </Popover>
    </div>
  );
}
