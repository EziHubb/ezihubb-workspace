'use client';

import Link from 'next/link';
import { HelpCircle, LifeBuoy, ShieldAlert, ScanSearch } from 'lucide-react';
import { Popover } from '@ezihubb/ui';

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
        <div className="space-y-1">
          {LINKS.map((l) => (
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
        <div className="mt-2 pt-2 border-t border-border">
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
