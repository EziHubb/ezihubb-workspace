'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { FAQ_FLAT } from './faq-data';

export function FAQSearchBar() {
  const [query, setQuery] = useState('');

  const trimmed  = query.trim();
  const isActive = trimmed.length >= 2;

  const filtered = isActive
    ? FAQ_FLAT.filter(
        (faq) =>
          faq.q.toLowerCase().includes(trimmed.toLowerCase()) ||
          faq.a.toLowerCase().includes(trimmed.toLowerCase()),
      ).slice(0, 6)
    : [];

  return (
    <div className="relative">
      {/* Input */}
      <div className="flex items-center gap-3 border border-border rounded-xl px-4 py-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors bg-background">
        <Search className="w-4 h-4 text-muted shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search questions… e.g. shipping, refund, personalization"
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-muted hover:text-secondary transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isActive && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-20 divide-y divide-border max-h-80 overflow-y-auto">
          {filtered.map((faq) => (
            <div key={faq.q} className="px-5 py-4">
              <p className="font-medium text-sm text-secondary mb-1">{faq.q}</p>
              <p className="text-xs text-muted line-clamp-2">{faq.a}</p>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {isActive && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-20 px-5 py-4 text-sm text-muted text-center">
          No results for &ldquo;{trimmed}&rdquo;.{' '}
          <Link href="/pages/contact" className="text-primary hover:underline">
            Ask us directly →
          </Link>
        </div>
      )}
    </div>
  );
}
