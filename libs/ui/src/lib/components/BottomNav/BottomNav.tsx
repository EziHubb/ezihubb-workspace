'use client';

import React from 'react';
import Link from 'next/link';

export type BottomNavTab = 'home' | 'search' | 'cart' | 'account';

export interface BottomNavProps {
  activeTab:  BottomNavTab;
  cartCount?: number;
}

interface NavTab {
  id:    BottomNavTab;
  label: string;
  href:  string;
  icon:  React.ReactNode;
}

const TABS: NavTab[] = [
  {
    id:    'home',
    label: 'Home',
    href:  '/',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    id:    'search',
    label: 'Search',
    href:  '/search',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
  },
  {
    id:    'cart',
    label: 'Cart',
    href:  '/cart',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
  },
  {
    id:    'account',
    label: 'Account',
    href:  '/account',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, cartCount = 0 }) => (
  <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border flex md:hidden">
    {TABS.map((tab) => {
      const isActive = tab.id === activeTab;
      return (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={isActive ? 'page' : undefined}
          className={[
            'flex-1 flex flex-col items-center justify-center pt-2 pb-3 gap-0.5',
            'text-[10px] font-medium transition-colors',
            isActive ? 'text-primary' : 'text-muted',
          ].join(' ')}
        >
          <span className="relative">
            {tab.icon}
            {tab.id === 'cart' && cartCount > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-bold inline-flex items-center justify-center px-0.5 leading-none">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </span>
          {tab.label}
        </Link>
      );
    })}
  </nav>
);
