'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES, ADMIN_ROUTES } from '@ezihubb/constants';
import { fmtCurrency } from '../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ListingRow {
  productId:  string;
  title:      string;
  imageUrl:   string | null;
  views:      number;
  favourites: number;
  orders:     number;
  revenue:    number;
}

interface ListingsResponse {
  data:       ListingRow[];
  pagination: { total: number; page: number; totalPages: number };
}

type SortKey = 'views' | 'favourites' | 'orders' | 'revenue';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ListingsStatsPage() {
  const router = useRouter();
  const [page,  setPage]  = useState(1);
  const [sort,  setSort]  = useState<SortKey>('views');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');

  const LIMIT = 20;

  const { data, isLoading } = useQuery<ListingsResponse>({
    queryKey: ['stats-listings', page, sort, order],
    queryFn:  () =>
      api.get(
        `${API_ROUTES.ADMIN.STATS_LISTINGS}?page=${page}&limit=${LIMIT}&sort=${order === 'desc' ? sort : `${sort}_asc`}`
      ),
  });

  const rows       = data?.data ?? [];
  const totalPages = data?.pagination.totalPages ?? 1;

  function handleSort(key: SortKey) {
    if (sort === key) {
      setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
    } else {
      setSort(key);
      setOrder('desc');
    }
    setPage(1);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sort !== col) return <span className="w-3 h-3 inline-block" />;
    return sort === col && order === 'desc'
      ? <ChevronDown className="w-3 h-3 inline-block ml-0.5 text-primary" />
      : <ChevronUp   className="w-3 h-3 inline-block ml-0.5 text-primary" />;
  }

  const cols: { key: SortKey; label: string }[] = [
    { key: 'views',      label: 'Views'      },
    { key: 'favourites', label: 'Favourites' },
    { key: 'orders',     label: 'Orders'     },
    { key: 'revenue',    label: 'Revenue'    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5 text-xs text-muted mb-1">
        <Link href={ADMIN_ROUTES.STATS} className="flex items-center gap-1 hover:text-secondary transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Stats
        </Link>
        <span>/</span>
        <span className="text-secondary">Listings Performance</span>
      </div>
      <AdminPageHeader
        title="Listings Performance"
        subtitle="See views, favourites, orders and revenue for each of your listings."
      />

      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/5">
              <th className="text-left px-4 py-3 font-medium text-muted text-xs">Listing</th>
              {cols.map(({ key, label }) => (
                <th
                  key={key}
                  className="text-right px-4 py-3 font-medium text-xs cursor-pointer select-none hover:text-secondary transition-colors"
                  onClick={() => handleSort(key)}
                >
                  <span className={sort === key ? 'text-primary font-semibold' : 'text-muted'}>
                    {label} <SortIcon col={key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-9 h-9 rounded" />
                        <Skeleton className="h-4 w-40" />
                      </div>
                    </td>
                    {cols.map(({ key }) => (
                      <td key={key} className="px-4 py-3 text-right">
                        <Skeleton className="h-4 w-12 ml-auto" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted">
                    No listing data yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.productId}
                    className="hover:bg-muted/5 transition-colors cursor-pointer group"
                    onClick={() => router.push(ADMIN_ROUTES.STATS_LISTING(row.productId))}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {row.imageUrl ? (
                          <img src={row.imageUrl} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded bg-border shrink-0" />
                        )}
                        <span className="text-secondary line-clamp-2 text-xs font-medium max-w-[260px] group-hover:text-primary transition-colors">
                          {row.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-secondary">{row.views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-secondary">{row.favourites.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-secondary">{row.orders.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium text-secondary">{fmtCurrency(row.revenue)}</td>
                  </tr>
                ))
              )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/5">
            <p className="text-xs text-muted">
              Page {page} of {totalPages} · {data?.pagination.total.toLocaleString()} listings
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium text-muted border border-border rounded-button hover:border-primary/40 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium text-muted border border-border rounded-button hover:border-primary/40 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
