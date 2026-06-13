'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Store, ShoppingBag, DollarSign, Star, Clock,
  ExternalLink, CheckCircle2, XCircle, PauseCircle, Package,
  ChevronRight, Globe, Calendar, User, ShieldCheck,
} from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { StatCard } from '../../../../components/data/StatCard';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import { fmtAmount, fmtDate, fmtFixed, safeArr } from '../../../../lib/fmt';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StoreDetail {
  id:           string;
  name:         string;
  slug:         string;
  description:  string | null;
  logoUrl:      string | null;
  bannerUrl:    string | null;
  status:       string;
  planType:     string;
  rating:       number;
  totalOrders:  number;
  totalRevenue: number;
  totalProducts:number;
  verifiedAt:   string | null;
  createdAt:    string;
  rejectionReason:  string | null;
  suspensionReason: string | null;
  owner: {
    id:        string;
    firstName: string | null;
    lastName:  string | null;
    email:     string;
    createdAt: string;
  };
}

interface StoreProduct {
  id:        string;
  name:      string;
  basePrice: number;
  isActive:  boolean;
  status:    string;
  soldCount: number;
  images?:   { url: string; isPrimary: boolean }[];
}

interface StoreOrder {
  id:             string;
  status:         string;
  sellerEarnings: number;
  createdAt:      string;
  order: { orderNumber: string };
  items: { productName: string; quantity: number }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700 border-amber-200',
  ACTIVE:    'bg-green-100 text-green-700 border-green-200',
  SUSPENDED: 'bg-orange-100 text-orange-700 border-orange-200',
  REJECTED:  'bg-red-100 text-red-700 border-red-200',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
  CONFIRMED:  'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-amber-100 text-amber-700',
  SHIPPED:    'bg-purple-100 text-purple-700',
  DELIVERED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
};

const PRODUCT_STATUS_COLORS: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  DRAFT:    'bg-amber-100 text-amber-700',
  ARCHIVED: 'bg-red-100 text-red-600',
};

// ── Action dialog ─────────────────────────────────────────────────────────────

function ActionModal({
  title,
  placeholder,
  onConfirm,
  onCancel,
  confirmLabel,
  confirmClass,
  requireReason = true,
}: {
  title:         string;
  placeholder:   string;
  onConfirm:     (reason: string) => void;
  onCancel:      () => void;
  confirmLabel:  string;
  confirmClass:  string;
  requireReason?: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-card shadow-modal w-full max-w-md p-6 space-y-4">
        <h3 className="font-semibold text-secondary text-base">{title}</h3>
        {requireReason && (
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full text-sm border border-border rounded-button px-3 py-2 resize-none focus:outline-none focus:border-primary"
          />
        )}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onCancel}
            className="px-4 py-2 text-sm font-medium border border-border rounded-button text-secondary hover:border-muted transition-colors">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm(reason)}
            disabled={requireReason && !reason.trim()}
            className={`px-4 py-2 text-sm font-medium text-white rounded-button transition-colors disabled:opacity-40 ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminStoreDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();

  const [modal, setModal] = useState<'approve' | 'reject' | 'suspend' | null>(null);

  const { data: store, isLoading } = useQuery<StoreDetail>({
    queryKey: ['admin-store', id],
    queryFn:  () => api.get<StoreDetail>(API_ROUTES.ADMIN.STORE(id)),
    enabled:  Boolean(id),
  });

  const { data: products, isLoading: productsLoading } = useQuery<{ data: StoreProduct[] }>({
    queryKey: ['admin-store-products', id],
    queryFn:  () => api.get<{ data: StoreProduct[] }>(`${API_ROUTES.ADMIN.STORE_PRODUCTS(id)}?limit=10`),
    enabled:  Boolean(id),
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<{ data: StoreOrder[] }>({
    queryKey: ['admin-store-orders', id],
    queryFn:  () => api.get<{ data: StoreOrder[] }>(`${API_ROUTES.ADMIN.STORE_ORDERS(id)}?limit=10`),
    enabled:  Boolean(id),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin-store', id] });

  const approveMutation = useMutation({
    mutationFn: () => api.post(API_ROUTES.ADMIN.STORE_APPROVE(id), {}),
    onSuccess:  () => { invalidate(); setModal(null); },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => api.post(API_ROUTES.ADMIN.STORE_REJECT(id), { reason }),
    onSuccess:  () => { invalidate(); setModal(null); },
  });

  const suspendMutation = useMutation({
    mutationFn: (reason: string) => api.post(API_ROUTES.ADMIN.STORE_SUSPEND(id), { reason }),
    onSuccess:  () => { invalidate(); setModal(null); },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted/20 rounded" />
        <div className="h-48 bg-muted/20 rounded-card" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted/20 rounded-card" />)}
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="text-center py-20">
        <Store className="w-12 h-12 text-muted/30 mx-auto mb-3" />
        <p className="text-secondary font-semibold">Store not found</p>
        <button type="button" onClick={() => router.back()}
          className="mt-4 text-sm text-primary hover:underline">
          ← Back to Stores
        </button>
      </div>
    );
  }

  const ownerName = [store.owner.firstName, store.owner.lastName].filter(Boolean).join(' ') || store.owner.email;
  const statusCfg = STATUS_COLORS[store.status] ?? 'bg-muted/10 text-muted border-muted/20';

  return (
    <>
      {/* ── Back + Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/stores" className="p-2 rounded-button border border-border text-muted hover:text-secondary hover:border-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <AdminPageHeader
            title={store.name}
            subtitle={`/shops/${store.slug}`}
            queryKey={['admin-store', id]}
          />
        </div>
        <a href={`/shops/${store.slug}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0">
          <ExternalLink className="w-4 h-4" />
          View store
        </a>
      </div>

      {/* ── Store header card ─────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden mb-6">
        {/* Banner */}
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5">
          {store.bannerUrl && (
            <Image src={store.bannerUrl} alt="banner" fill className="object-cover" sizes="100vw" />
          )}
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            <div className="w-20 h-20 rounded-xl border-4 border-surface bg-surface overflow-hidden shadow shrink-0">
              {store.logoUrl ? (
                <Image src={store.logoUrl} alt="logo" width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                  {store.name[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <div className="pb-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg}`}>
                  {store.status === 'ACTIVE' && <CheckCircle2 className="w-3 h-3" />}
                  {store.status === 'PENDING' && <Clock className="w-3 h-3" />}
                  {store.status === 'SUSPENDED' && <PauseCircle className="w-3 h-3" />}
                  {store.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                  {store.status}
                </span>
                {store.verifiedAt && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    Verified seller
                  </span>
                )}
                <span className="text-xs text-muted bg-background border border-border px-2 py-0.5 rounded-full">
                  {store.planType}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {store.description && (
                <p className="text-sm text-secondary/80 leading-relaxed line-clamp-3">{store.description}</p>
              )}
              <div className="flex flex-col gap-1.5 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <User className="w-3 h-3" /> {ownerName} · {store.owner.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> dailydaisy.com/shops/{store.slug}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Applied {fmtDate(store.createdAt)}
                </span>
                {store.verifiedAt && (
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-green-600" /> Verified {fmtDate(store.verifiedAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Action panel */}
            <div className="bg-background border border-border rounded-card p-4 space-y-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Actions</p>
              <div className="flex flex-wrap gap-2">
                {store.status === 'PENDING' && (
                  <>
                    <button type="button" onClick={() => setModal('approve')}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-button hover:bg-green-700 transition-colors">
                      <CheckCircle2 className="w-4 h-4" /> Approve
                    </button>
                    <button type="button" onClick={() => setModal('reject')}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-error rounded-button hover:opacity-80 transition-colors">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </>
                )}
                {store.status === 'ACTIVE' && (
                  <button type="button" onClick={() => setModal('suspend')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border text-secondary rounded-button hover:border-error hover:text-error transition-colors">
                    <PauseCircle className="w-4 h-4" /> Suspend
                  </button>
                )}
                {store.status === 'SUSPENDED' && (
                  <button type="button" onClick={() => approveMutation.mutate()}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-button hover:bg-green-700 transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Re-activate
                  </button>
                )}
              </div>
              {store.rejectionReason && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-button px-3 py-2">
                  <span className="font-semibold">Rejection reason:</span> {store.rejectionReason}
                </div>
              )}
              {store.suspensionReason && (
                <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-button px-3 py-2">
                  <span className="font-semibold">Suspension reason:</span> {store.suspensionReason}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Orders"   value={String(store.totalOrders)}  icon={ShoppingBag} color="blue" />
        <StatCard label="Total Revenue"  value={fmtAmount(store.totalRevenue)} icon={DollarSign} color="coral" prefix="$" />
        <StatCard label="Store Rating"   value={store.rating > 0 ? store.rating.toFixed(1) : '—'} icon={Star} color="amber" />
        <StatCard label="Active Products" value={String(store.totalProducts)} icon={Package} color="blue" />
      </div>

      {/* ── Products ──────────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-secondary text-sm">Products</h3>
          <span className="text-xs text-muted">{safeArr(products?.data).length} shown</span>
        </div>
        {productsLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/10 rounded animate-pulse" />
            ))}
          </div>
        ) : !products?.data?.length ? (
          <div className="p-10 text-center text-sm text-muted">No products yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {products.data.map((p) => {
              const thumb = p.images?.find((i) => i.isPrimary)?.url ?? p.images?.[0]?.url;
              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3 hover:bg-background transition-colors">
                  <div className="w-9 h-9 rounded-md bg-muted/20 overflow-hidden shrink-0 flex items-center justify-center">
                    {thumb
                      ? <img src={thumb} alt={p.name} className="w-full h-full object-cover" />
                      : <Package className="w-4 h-4 text-muted" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-secondary truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${PRODUCT_STATUS_COLORS[p.status] ?? 'bg-muted/10 text-muted'}`}>
                        {p.status}
                      </span>
                      <span className="text-xs text-muted">{p.soldCount} sold</span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-secondary tabular-nums shrink-0">
                    ${fmtFixed(p.basePrice, 2)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Recent Orders ─────────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-secondary text-sm">Recent Orders</h3>
          <span className="text-xs text-muted">{safeArr(orders?.data).length} shown</span>
        </div>
        {ordersLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/10 rounded animate-pulse" />
            ))}
          </div>
        ) : !orders?.data?.length ? (
          <div className="p-10 text-center text-sm text-muted">No orders yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {orders.data.map((o) => (
              <div key={o.id} className="flex items-center gap-4 px-5 py-3 hover:bg-background transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-semibold text-secondary">{o.order.orderNumber}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ORDER_STATUS_COLORS[o.status] ?? 'bg-muted/10 text-muted'}`}>
                      {o.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate">
                    {o.items.map((i) => `${i.productName} ×${i.quantity}`).join(' · ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-secondary tabular-nums">{fmtAmount(o.sellerEarnings)}</p>
                  <p className="text-xs text-muted">{fmtDate(o.createdAt)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {modal === 'approve' && (
        <ActionModal
          title="Approve this store?"
          placeholder=""
          requireReason={false}
          onConfirm={() => approveMutation.mutate()}
          onCancel={() => setModal(null)}
          confirmLabel="Approve"
          confirmClass="bg-green-600 hover:bg-green-700"
        />
      )}
      {modal === 'reject' && (
        <ActionModal
          title="Reject this store application"
          placeholder="Enter rejection reason (visible to the seller)..."
          onConfirm={(reason) => rejectMutation.mutate(reason)}
          onCancel={() => setModal(null)}
          confirmLabel="Reject"
          confirmClass="bg-error hover:opacity-80"
        />
      )}
      {modal === 'suspend' && (
        <ActionModal
          title="Suspend this store"
          placeholder="Enter suspension reason (visible to the seller)..."
          onConfirm={(reason) => suspendMutation.mutate(reason)}
          onCancel={() => setModal(null)}
          confirmLabel="Suspend"
          confirmClass="bg-orange-600 hover:bg-orange-700"
        />
      )}
    </>
  );
}
