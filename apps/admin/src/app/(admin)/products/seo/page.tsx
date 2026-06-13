'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Search, ArrowUpRight, Package } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeoProductRow {
  id:               string;
  name:             string;
  slug:             string;
  isActive:         boolean;
  imageUrl?:        string | null;
  metaTitle?:       string | null;
  metaDescription?: string | null;
}

interface SeoStatsResponse {
  total:              number;
  missingTitle:       number;
  missingDescription: number;
  lowScore:           number;
  noIndex:            number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreProduct(p: SeoProductRow): number {
  let score = 0;
  const title = p.metaTitle?.trim() ?? '';
  const desc  = p.metaDescription?.trim() ?? '';
  if (title.length >= 10 && title.length <= 70)   score += 40;
  else if (title.length > 0)                       score += 20;
  if (desc.length >= 50 && desc.length <= 160)     score += 40;
  else if (desc.length > 0)                        score += 20;
  if (p.imageUrl)                                  score += 10;
  if (p.isActive)                                  score += 10;
  return score;
}

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80 ? 'bg-green-100 text-green-700' :
    score >= 50 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-bold tabular-nums ${cls}`}>
      {score}
    </span>
  );
}

function FieldStatus({ value, minLen = 10 }: { value?: string | null; minLen?: number }) {
  const ok = (value?.trim().length ?? 0) >= minLen;
  return ok
    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
    : <AlertTriangle className="w-4 h-4 text-amber-500" />;
}

type FilterKey = 'all' | 'issues';

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function ProductsSeoPage() {
  const [filter,  setFilter]  = useState<FilterKey>('all');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);

  const { data: statsData } = useQuery<SeoStatsResponse>({
    queryKey: ['seo-stats'],
    queryFn:  async () => {
      try {
        return await api.get<SeoStatsResponse>(API_ROUTES.ADMIN.PRODUCTS_SEO_STATS);
      } catch {
        return { total: 0, missingTitle: 0, missingDescription: 0, lowScore: 0, noIndex: 0 };
      }
    },
    staleTime: 60_000,
  });

  const { data: productsData, isLoading } = useQuery<{ data: SeoProductRow[]; total: number }>({
    queryKey: ['seo-products', page, search],
    queryFn:  async () => {
      try {
        const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
        if (search) params['q'] = search;
        return await api.get<{ data: SeoProductRow[]; total: number }>(API_ROUTES.ADMIN.PRODUCTS, { params });
      } catch {
        return { data: [], total: 0 };
      }
    },
    staleTime: 30_000,
  });

  const allProducts = productsData?.data ?? [];
  const total       = productsData?.total ?? 0;

  // Client-side filter for "issues" (products with score < 70)
  const products = useMemo(() => {
    const filtered = filter === 'issues'
      ? allProducts.filter((p) => scoreProduct(p) < 70)
      : allProducts;
    return filtered;
  }, [allProducts, filter]);

  const stats = statsData ?? { total: 0, missingTitle: 0, missingDescription: 0, lowScore: 0, noIndex: 0 };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <AdminPageHeader
        title="SEO Audit"
        subtitle="Review and fix product metadata to improve search rankings"
        actions={
          <Link
            href="/products"
            className="text-sm text-muted hover:text-secondary transition-colors"
          >
            ← All Products
          </Link>
        }
        queryKey={['seo-products']}
      />

      {/* ── Stats strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Missing SEO Title',       value: stats.missingTitle,       color: stats.missingTitle > 0       ? 'text-amber-600' : 'text-green-600' },
          { label: 'Missing Description',      value: stats.missingDescription, color: stats.missingDescription > 0 ? 'text-amber-600' : 'text-green-600' },
          { label: 'Score < 70',               value: stats.lowScore,           color: stats.lowScore > 0           ? 'text-red-600'   : 'text-green-600' },
          { label: 'Total Products',           value: stats.total,              color: 'text-secondary' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-border rounded-card p-4">
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search products…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-button bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex gap-1 p-1 bg-surface border border-border rounded-button">
          {(['all', 'issues'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setFilter(k); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${filter === k ? 'bg-primary text-white' : 'text-muted hover:text-secondary'}`}
            >
              {k === 'all' ? 'All Products' : 'Has Issues'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background">
              {['Product', 'SEO Title', 'Description', 'Score', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted text-sm">
                      {filter === 'issues' ? 'No products with SEO issues — great job!' : 'No products found.'}
                    </td>
                  </tr>
                )
              : products.map((p) => {
                  const score = scoreProduct(p);
                  return (
                    <tr key={p.id} className="hover:bg-muted/3 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <Image
                              src={p.imageUrl}
                              alt={p.name}
                              width={36}
                              height={36}
                              className="w-9 h-9 rounded-lg object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-muted/10 flex items-center justify-center border border-border shrink-0">
                              <Package className="w-4 h-4 text-muted" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-secondary text-sm truncate max-w-[220px]">
                              {p.name}
                            </p>
                            <p className="text-xs text-muted font-mono truncate">{p.slug}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FieldStatus value={p.metaTitle} minLen={10} />
                          {p.metaTitle ? (
                            <span className="text-xs text-secondary truncate max-w-[180px]" title={p.metaTitle}>
                              {p.metaTitle}
                            </span>
                          ) : (
                            <span className="text-xs text-muted italic">Not set</span>
                          )}
                        </div>
                        {p.metaTitle && (
                          <p className="text-[11px] text-muted mt-0.5 ml-6">{p.metaTitle.length} chars</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FieldStatus value={p.metaDescription} minLen={50} />
                          {p.metaDescription ? (
                            <span className="text-xs text-secondary truncate max-w-[200px]" title={p.metaDescription}>
                              {p.metaDescription}
                            </span>
                          ) : (
                            <span className="text-xs text-muted italic">Not set</span>
                          )}
                        </div>
                        {p.metaDescription && (
                          <p className="text-[11px] text-muted mt-0.5 ml-6">{p.metaDescription.length} chars</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <ScoreBadge score={score} />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/products/${p.id}/edit`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Edit SEO
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-button disabled:opacity-40 hover:border-primary/40 transition-colors"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs font-medium border border-border rounded-button disabled:opacity-40 hover:border-primary/40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
