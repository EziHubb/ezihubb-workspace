'use client';

import { use, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import {
  ArrowLeft, Eye, Heart, ShoppingBag, DollarSign,
  Star, ExternalLink, CheckCircle, EyeOff, MessageSquare,
  ChevronLeft, ChevronRight, Image as ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import { api } from '../../../../../lib/api-client';
import { API_ROUTES, ADMIN_ROUTES } from '@ezihubb/constants';
import { fmtCurrency, fmtDate, fmtNum } from '../../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

type Range = '7d' | '30d' | '90d';
type ReviewStatus = 'PENDING' | 'APPROVED' | 'HIDDEN';

interface ListingStatsData {
  product: {
    id:             string;
    name:           string;
    slug:           string;
    status:         string;
    isActive:       boolean;
    imageUrl:       string | null;
    basePrice:      number;
    compareAtPrice: number | null;
    createdAt:      string;
  };
  summary: {
    views:      number;
    orders:     number;
    revenue:    number;
    favourites: number;
    reviews:    number;
    avgRating:  number | null;
  };
  timeSeries: Array<{ date: string; visits: number; orders: number; revenue: number }>;
}

interface ReviewSummaryData {
  averageRating: number;
  totalReviews:  number;
  distribution:  Record<string, number>;
}

interface AdminReview {
  id:                string;
  userId:            string;
  rating:            number;
  title?:            string | null;
  body:              string;
  imageUrls:         string[];
  status:            ReviewStatus;
  adminReply?:       string | null;
  repliedAt?:        string | null;
  createdAt:         string;
  customerName:      string;
  customerEmail:     string;
  customerAvatarUrl?: string | null;
}

interface ReviewsPage {
  data: AdminReview[];
  pagination: { total: number; page: number; totalPages: number };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGES: { id: Range; label: string }[] = [
  { id: '7d',  label: 'Last 7 days'  },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
];

const REVIEW_STATUS_TABS: { id: string; label: string }[] = [
  { id: '',         label: 'All'      },
  { id: 'PENDING',  label: 'Pending'  },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'HIDDEN',   label: 'Hidden'   },
];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  ARCHIVED: 'bg-orange-100 text-orange-700',
  DRAFT:    'bg-blue-100 text-blue-700',
};

const REVIEW_STATUS_BADGE: Record<ReviewStatus, string> = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  HIDDEN:   'bg-gray-100 text-gray-500',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-border rounded ${className}`} />;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-primary',
}: {
  icon:   React.ElementType;
  label:  string;
  value:  string;
  sub?:   string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-card p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted">{label}</span>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-2xl font-bold text-secondary tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?:  boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length || !label) return null;
  let dateLabel = label;
  try { dateLabel = fmtDate(label); } catch { /* keep raw */ }
  return (
    <div className="bg-surface border border-border rounded-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-secondary mb-1.5">{dateLabel}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-muted">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="capitalize">{p.dataKey}:</span>
          <span className="font-medium text-secondary">
            {p.dataKey === 'revenue' ? fmtCurrency(p.value) : fmtNum(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < full ? 'text-amber-400 fill-amber-400' :
              i === full && half ? 'text-amber-400 fill-amber-200' :
              'text-border fill-border'
            }`}
          />
        ))}
      </div>
      <span className="text-sm font-semibold text-secondary">{rating.toFixed(1)}</span>
      <span className="text-xs text-muted">({count} reviews)</span>
    </div>
  );
}

// ── Inline stars (small, read-only) ──────────────────────────────────────────

function InlineStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-border fill-border'}`}
        />
      ))}
    </div>
  );
}

// ── Avatar initials ────────────────────────────────────────────────────────────

function Avatar({ name, url }: { name: string; url?: string | null }) {
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  if (url) {
    return <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

// ── Review card ────────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  productId,
}: {
  review:    AdminReview;
  productId: string;
}) {
  const qc          = useQueryClient();
  const [replying,  setReplying]  = useState(false);
  const [replyText, setReplyText] = useState(review.adminReply ?? '');
  const [lightbox,  setLightbox]  = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ['listing-reviews', productId] });

  const approveMutation = useMutation({
    mutationFn: () => api.post(`${API_ROUTES.ADMIN.REVIEW_APPROVE(review.id)}`),
    onSuccess:  invalidate,
  });
  const hideMutation = useMutation({
    mutationFn: () => api.post(`${API_ROUTES.ADMIN.REVIEW_HIDE(review.id)}`),
    onSuccess:  invalidate,
  });
  const replyMutation = useMutation({
    mutationFn: (reply: string) =>
      api.post(`${API_ROUTES.ADMIN.REVIEW_REPLY(review.id)}`, { reply }),
    onSuccess: () => { setReplying(false); invalidate(); },
  });

  const isBusy = approveMutation.isPending || hideMutation.isPending || replyMutation.isPending;

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Review image" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      <div className="border border-border rounded-card p-4 space-y-3 hover:shadow-sm transition-shadow">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={review.customerName} url={review.customerAvatarUrl} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-secondary truncate">{review.customerName}</p>
              <p className="text-xs text-muted truncate">{review.customerEmail}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${REVIEW_STATUS_BADGE[review.status]}`}>
              {review.status}
            </span>
            <span className="text-xs text-muted">{fmtDate(review.createdAt)}</span>
          </div>
        </div>

        {/* Stars + title */}
        <div className="flex items-center gap-2 flex-wrap">
          <InlineStars rating={review.rating} />
          {review.title && (
            <span className="text-sm font-semibold text-secondary">{review.title}</span>
          )}
        </div>

        {/* Body */}
        <p className="text-sm text-secondary leading-relaxed">{review.body}</p>

        {/* Images */}
        {review.imageUrls.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {review.imageUrls.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setLightbox(url)}
                className="w-16 h-16 rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition-all shrink-0"
              >
                <img src={url} alt={`Review image ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
            <div className="flex items-center gap-1 text-xs text-muted self-center">
              <ImageIcon className="w-3 h-3" />
              {review.imageUrls.length} photo{review.imageUrls.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Existing admin reply */}
        {review.adminReply && !replying && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5">
            <p className="text-[11px] font-semibold text-blue-700 mb-1">Admin reply</p>
            <p className="text-xs text-blue-900 leading-relaxed">{review.adminReply}</p>
          </div>
        )}

        {/* Inline reply form */}
        {replying && (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
              placeholder="Write a reply…"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-primary/60 bg-surface"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isBusy || !replyText.trim()}
                onClick={() => replyMutation.mutate(replyText.trim())}
                className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-button disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {replyMutation.isPending ? 'Saving…' : 'Save Reply'}
              </button>
              <button
                type="button"
                onClick={() => { setReplying(false); setReplyText(review.adminReply ?? ''); }}
                className="px-3 py-1.5 border border-border text-xs font-medium rounded-button hover:border-primary/40 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
          {review.status !== 'APPROVED' && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => approveMutation.mutate()}
              className="inline-flex items-center gap-1 text-xs font-medium text-green-700 border border-green-200 rounded-button px-2.5 py-1 hover:bg-green-50 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="w-3 h-3" />
              Approve
            </button>
          )}
          {review.status !== 'HIDDEN' && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => hideMutation.mutate()}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-button px-2.5 py-1 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <EyeOff className="w-3 h-3" />
              Hide
            </button>
          )}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => { setReplying(true); setTimeout(() => textareaRef.current?.focus(), 50); }}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 border border-blue-200 rounded-button px-2.5 py-1 hover:bg-blue-50 disabled:opacity-50 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            {review.adminReply ? 'Edit Reply' : 'Reply'}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ListingStatsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id }       = use(params);
  const [range,  setRange]  = useState<Range>('30d');
  const [metric, setMetric] = useState<'visits' | 'orders' | 'revenue'>('visits');

  // Reviews section state
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewPage,   setReviewPage]   = useState(1);

  // ── Stats query ──────────────────────────────────────────────────────────────
  const { data, isLoading, isFetching } = useQuery<ListingStatsData>({
    queryKey: ['listing-stats', id, range],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.STATS_LISTING(id)}?range=${range}`),
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  // ── Review summary (distribution bars) ───────────────────────────────────────
  const { data: reviewSummary } = useQuery<ReviewSummaryData>({
    queryKey: ['listing-review-summary', data?.product?.slug],
    queryFn:  () =>
      api.get(`/products/${data!.product.slug}/reviews/summary`),
    enabled: !!data?.product?.slug,
    staleTime: 60_000,
  });

  // ── Paginated reviews list ────────────────────────────────────────────────────
  const reviewsQP = new URLSearchParams({
    productId: id,
    page:      String(reviewPage),
    limit:     '8',
    ...(reviewStatus ? { status: reviewStatus } : {}),
  });
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery<ReviewsPage>({
    queryKey: ['listing-reviews', id, reviewStatus, reviewPage],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.REVIEWS}?${reviewsQP}`),
    enabled:  !!id,
    staleTime: 30_000,
  });

  const p  = data?.product;
  const s  = data?.summary;
  const ts = data?.timeSeries ?? [];

  const METRIC_CFG = {
    visits:  { label: 'Views',   color: '#6366f1', stroke: '#6366f1' },
    orders:  { label: 'Orders',  color: '#22c55e', stroke: '#22c55e' },
    revenue: { label: 'Revenue', color: '#f59e0b', stroke: '#f59e0b' },
  } as const;

  const dist      = reviewSummary?.distribution ?? {};
  const totalRevs = reviewSummary?.totalReviews ?? 0;

  const reviews    = reviewsData?.data        ?? [];
  const revTotal   = reviewsData?.pagination?.total      ?? 0;
  const revPages   = reviewsData?.pagination?.totalPages ?? 1;

  return (
    <div className="space-y-6">

      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <Link href={ADMIN_ROUTES.STATS} className="hover:text-secondary transition-colors">Stats</Link>
        <span>/</span>
        <Link href={ADMIN_ROUTES.STATS_LISTINGS} className="hover:text-secondary transition-colors">Listings</Link>
        <span>/</span>
        <span className="text-secondary truncate max-w-[200px]">{p?.name ?? 'Loading…'}</span>
      </div>

      {/* ── Product header ──────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex gap-4">
          <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      ) : p && (
        <div className="flex items-start gap-4">
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name}
              className="w-20 h-20 rounded-lg object-cover border border-border shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-border shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-semibold text-secondary leading-snug line-clamp-2">{p.name}</h1>
              <a
                href={`${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3000'}/products/${p.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted border border-border rounded-button px-2.5 py-1.5 hover:border-primary/40 hover:text-primary transition-colors shrink-0"
              >
                <ExternalLink className="w-3 h-3" /> View
              </a>
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {p.status}
              </span>
              <span className="text-sm font-bold text-secondary">{fmtCurrency(p.basePrice)}</span>
              {p.compareAtPrice && (
                <span className="text-xs text-muted line-through">{fmtCurrency(p.compareAtPrice)}</span>
              )}
              <span className="text-xs text-muted">Listed {fmtDate(p.createdAt)}</span>
            </div>
            {s?.avgRating != null && s.reviews > 0 && (
              <div className="mt-2">
                <StarRow rating={s.avgRating} count={s.reviews} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Date range selector ─────────────────────────────────────────────── */}
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            className={[
              'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
              range === r.id
                ? 'bg-primary text-white border-primary'
                : 'bg-surface text-muted border-border hover:border-primary/40 hover:text-secondary',
            ].join(' ')}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard icon={Eye}         label="Views"      value={fmtNum(s?.views ?? 0)}           color="text-indigo-500" />
            <KpiCard icon={Heart}       label="Favourites" value={fmtNum(s?.favourites ?? 0)}       color="text-rose-500"   />
            <KpiCard icon={ShoppingBag} label="Orders"     value={fmtNum(s?.orders ?? 0)}           color="text-green-500"  />
            <KpiCard
              icon={DollarSign}
              label="Revenue"
              value={fmtCurrency(s?.revenue ?? 0)}
              sub={s?.orders ? `Avg ${fmtCurrency((s.revenue) / s.orders)} / order` : undefined}
              color="text-amber-500"
            />
          </>
        )}
      </div>

      {/* ── Time series chart ──────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-secondary">Performance over time</h2>
          <div className="flex gap-1">
            {(['visits', 'orders', 'revenue'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={[
                  'px-3 py-1 rounded-full text-xs font-medium transition-colors border capitalize',
                  metric === m
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-transparent text-muted hover:text-secondary',
                ].join(' ')}
              >
                {METRIC_CFG[m].label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-52" />
        ) : ts.length === 0 ? (
          <p className="h-52 flex items-center justify-center text-sm text-muted">No data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ts} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={METRIC_CFG[metric].color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={METRIC_CFG[metric].color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => { try { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; } catch { return v; } }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => metric === 'revenue' ? `$${v}` : String(v)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={METRIC_CFG[metric].stroke}
                strokeWidth={2}
                fill="url(#grad)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Conversion funnel ──────────────────────────────────────────────── */}
      {!isLoading && s && (
        <div className="bg-surface border border-border rounded-card p-6">
          <h2 className="text-sm font-semibold text-secondary mb-4">Conversion funnel</h2>
          <div className="space-y-3">
            {[
              { label: 'Views',      value: s.views,      color: 'bg-indigo-400' },
              { label: 'Favourites', value: s.favourites, color: 'bg-rose-400'   },
              { label: 'Orders',     value: s.orders,     color: 'bg-green-400'  },
            ].map(({ label, value, color }) => {
              const pct = s.views > 0 ? Math.min(100, (value / s.views) * 100) : 0;
              return (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-muted shrink-0">{label}</span>
                  <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-20 text-right text-sm font-medium text-secondary">{fmtNum(value)}</span>
                  <span className="w-14 text-right text-xs text-muted">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
          {s.views > 0 && s.orders > 0 && (
            <p className="mt-4 text-xs text-muted">
              Conversion rate (views → orders):
              <span className="font-semibold text-secondary ml-1">
                {((s.orders / s.views) * 100).toFixed(2)}%
              </span>
            </p>
          )}
        </div>
      )}

      {/* ── Bar chart: views vs orders ──────────────────────────────────────── */}
      {!isLoading && ts.length > 0 && (
        <div className="bg-surface border border-border rounded-card p-6">
          <h2 className="text-sm font-semibold text-secondary mb-4">Views vs Orders</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={ts} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
                tickLine={false} axisLine={false}
                tickFormatter={(v) => { try { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; } catch { return v; } }}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="visits" name="Views"  fill="#6366f1" radius={[3,3,0,0]} maxBarSize={20} />
              <Bar dataKey="orders" name="Orders" fill="#22c55e" radius={[3,3,0,0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Reviews summary (distribution) ───────────────────────────────────── */}
      {!isLoading && s && s.reviews > 0 && (
        <div className="bg-surface border border-border rounded-card p-6">
          <h2 className="text-sm font-semibold text-secondary mb-4">Rating distribution</h2>
          <div className="flex items-start gap-8">
            <div className="text-center shrink-0">
              <p className="text-5xl font-bold text-secondary tabular-nums">
                {reviewSummary?.averageRating.toFixed(1) ?? s.avgRating?.toFixed(1) ?? '—'}
              </p>
              {(reviewSummary?.averageRating ?? s.avgRating) != null && (
                <StarRow
                  rating={reviewSummary?.averageRating ?? s.avgRating!}
                  count={reviewSummary?.totalReviews ?? s.reviews}
                />
              )}
              <p className="text-xs text-muted mt-1">{totalRevs || s.reviews} total reviews</p>
            </div>
            <div className="flex-1 space-y-2 py-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = dist[String(star)] ?? 0;
                const pct   = totalRevs > 0 ? (count / totalRevs) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-muted w-3 text-right shrink-0">{star}</span>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                    <div className="flex-1 h-2.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted tabular-nums w-16 text-right shrink-0">
                      {count > 0 ? `${count} (${pct.toFixed(0)}%)` : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Reviews list ─────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-secondary">Reviews</h2>
            {!reviewsLoading && (
              <p className="text-xs text-muted mt-0.5">
                {revTotal} review{revTotal !== 1 ? 's' : ''} total
              </p>
            )}
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1">
            {REVIEW_STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setReviewStatus(tab.id); setReviewPage(1); }}
                className={[
                  'px-3 py-1 text-xs font-medium rounded-full border transition-colors',
                  reviewStatus === tab.id
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-muted hover:border-primary/40 hover:text-secondary',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {reviewsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border border-border rounded-card p-4 space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-10 text-center">
              <Star className="w-10 h-10 text-border mx-auto mb-3" />
              <p className="text-sm font-medium text-secondary">No reviews yet</p>
              <p className="text-xs text-muted mt-1">
                {reviewStatus ? 'No reviews with this status.' : 'This product has not been reviewed.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <ReviewCard key={r.id} review={r} productId={id} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!reviewsLoading && revPages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted">
              Page {reviewPage} of {revPages} · {revTotal} reviews
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={reviewPage <= 1}
                onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary/40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={reviewPage >= revPages}
                onClick={() => setReviewPage((p) => p + 1)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-border rounded-button disabled:opacity-40 hover:border-primary/40 transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
