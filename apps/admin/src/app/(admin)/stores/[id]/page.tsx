'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Store, ShoppingBag, DollarSign, Star, Clock,
  ExternalLink, CheckCircle2, XCircle, PauseCircle, Package,
  ChevronRight, Globe, Calendar, User, ShieldCheck, Pencil,
  Camera, Upload, Loader2, Image as ImageIcon,
} from 'lucide-react';
import { AdminPageHeader } from '../../../../components/layout/AdminPageHeader';
import { StatCard } from '../../../../components/data/StatCard';
import { api, adminApi } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
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

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE      = 10 * 1024 * 1024; // 10 MB

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

// ── Store Edit Modal ──────────────────────────────────────────────────────────

function StoreEditModal({
  store,
  onClose,
  onSaved,
}: {
  store:   StoreDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name,        setName]        = useState(store.name);
  const [description, setDescription] = useState(store.description ?? '');
  const [bannerUrl,   setBannerUrl]   = useState(store.bannerUrl);
  const [logoUrl,     setLogoUrl]     = useState(store.logoUrl);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [logoLoading,   setLogoLoading]   = useState(false);
  const [saveError,  setSaveError]    = useState('');

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef   = useRef<HTMLInputElement>(null);

  // ── Image upload helpers ────────────────────────────────────────────────

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) return 'Only JPG, PNG and WebP images are allowed.';
    if (file.size > MAX_SIZE)               return 'File must be under 10 MB.';
    return null;
  };

  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setSaveError(err); return; }

    setBannerLoading(true);
    setSaveError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await adminApi.post<{ data?: { bannerUrl: string }; bannerUrl?: string }>(
        API_ROUTES.ADMIN.STORE_BANNER(store.id),
        form,
      );
      const payload = res.data?.data ?? res.data;
      setBannerUrl((payload as { bannerUrl: string }).bannerUrl);
      onSaved();
    } catch {
      setSaveError('Banner upload failed. Please try again.');
    } finally {
      setBannerLoading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setSaveError(err); return; }

    setLogoLoading(true);
    setSaveError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await adminApi.post<{ data?: { logoUrl: string }; logoUrl?: string }>(
        API_ROUTES.ADMIN.STORE_LOGO(store.id),
        form,
      );
      const payload = res.data?.data ?? res.data;
      setLogoUrl((payload as { logoUrl: string }).logoUrl);
      onSaved();
    } catch {
      setSaveError('Logo upload failed. Please try again.');
    } finally {
      setLogoLoading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  // ── Save text fields ────────────────────────────────────────────────────

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await api.patch(API_ROUTES.ADMIN.STORE(store.id), { name: name.trim(), description: description.trim() || null });
      onSaved();
      onClose();
    } catch {
      setSaveError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-card shadow-modal w-full max-w-xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-secondary text-base">Edit Store Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-muted hover:bg-muted/10 hover:text-secondary transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* ── Banner ─────────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Banner Image
            </label>
            <div
              className="relative h-32 rounded-card overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5 cursor-pointer group"
              onClick={() => bannerInputRef.current?.click()}
            >
              {bannerUrl && (
                <Image src={bannerUrl} alt="banner" fill className="object-cover" sizes="576px" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                {bannerLoading ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-1 text-white">
                    <Camera className="w-7 h-7" />
                    <span className="text-xs font-semibold">Upload Banner</span>
                  </div>
                )}
              </div>
              {!bannerUrl && !bannerLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1 text-muted/50">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-xs">Click to upload banner</span>
                  </div>
                </div>
              )}
            </div>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleBannerFile}
            />
            <p className="text-xs text-muted mt-1">Recommended: 1200 × 300 px · JPG, PNG or WebP · max 10 MB</p>
          </div>

          {/* ── Logo ───────────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Logo Image
            </label>
            <div className="flex items-center gap-4">
              <div
                className="relative w-20 h-20 rounded-xl border-2 border-dashed border-border overflow-hidden bg-muted/5 cursor-pointer group flex items-center justify-center shrink-0"
                onClick={() => logoInputRef.current?.click()}
              >
                {logoUrl ? (
                  <Image src={logoUrl} alt="logo" width={80} height={80} className="object-cover w-full h-full" />
                ) : (
                  <span className="text-2xl font-bold text-primary/40">
                    {store.name[0]?.toUpperCase()}
                  </span>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                  {logoLoading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
              <div className="text-xs text-muted space-y-0.5">
                <p className="font-medium text-secondary">Store Logo</p>
                <p>Click the logo to upload a new image</p>
                <p>JPG, PNG or WebP · max 10 MB</p>
                <p>Recommended: 400 × 400 px (square)</p>
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleLogoFile}
            />
          </div>

          {/* ── Name ───────────────────────────────────────────────────── */}
          <div>
            <label htmlFor="edit-store-name" className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Store Name
            </label>
            <input
              id="edit-store-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              className="w-full text-sm border border-border rounded-button px-3 py-2.5 focus:outline-none focus:border-primary transition-colors"
              placeholder="Store name"
            />
          </div>

          {/* ── Description ────────────────────────────────────────────── */}
          <div>
            <label htmlFor="edit-store-desc" className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
              Description
            </label>
            <textarea
              id="edit-store-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              className="w-full text-sm border border-border rounded-button px-3 py-2.5 resize-none focus:outline-none focus:border-primary transition-colors"
              placeholder="Describe the store..."
            />
            <p className="text-xs text-muted text-right mt-0.5">{description.length}/2000</p>
          </div>

          {/* Error */}
          {saveError && (
            <p className="text-xs text-error bg-error/5 border border-error/20 rounded-button px-3 py-2">
              {saveError}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-background rounded-b-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-border text-secondary rounded-button hover:border-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary rounded-button hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
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
  const { data: session } = useSession();
  const sessionUser = session?.user as Record<string, unknown> | undefined;
  const role         = sessionUser?.['role']    as string | undefined;
  const sessionStore = sessionUser?.['storeId'] as string | null | undefined;

  // Shop owners can only view their own store
  useEffect(() => {
    if (role === 'ADMIN' && sessionStore && id !== sessionStore) {
      router.replace(`/stores/${sessionStore}`);
    }
  }, [role, sessionStore, id, router]);

  const [modal, setModal] = useState<'approve' | 'reject' | 'suspend' | 'edit' | null>(null);

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setModal('edit')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-border text-secondary rounded-button hover:border-primary hover:text-primary transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
          <a href={`/shops/${store.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ExternalLink className="w-4 h-4" />
            View store
          </a>
        </div>
      </div>

      {/* ── Store header card ─────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-card overflow-hidden mb-6">
        {/* Banner */}
        <div className="relative h-32 bg-gradient-to-br from-primary/20 to-primary/5">
          {store.bannerUrl && (
            <Image src={store.bannerUrl} alt="banner" fill className="object-cover" sizes="100vw" />
          )}
          {/* Quick-edit banner overlay */}
          <button
            type="button"
            onClick={() => setModal('edit')}
            title="Edit banner"
            className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 hover:bg-black/70 text-white text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors backdrop-blur-sm"
          >
            <Camera className="w-3.5 h-3.5" />
            Change banner
          </button>
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-end gap-4 -mt-10 mb-4">
            {/* Logo with quick-edit */}
            <div
              className="relative w-20 h-20 rounded-xl border-4 border-surface bg-surface overflow-hidden shadow cursor-pointer group shrink-0"
              onClick={() => setModal('edit')}
              title="Edit logo"
            >
              {store.logoUrl ? (
                <Image src={store.logoUrl} alt="logo" width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                  {store.name[0]?.toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                <Camera className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="pb-1 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg}`}>
                  {store.status === 'ACTIVE'    && <CheckCircle2 className="w-3 h-3" />}
                  {store.status === 'PENDING'   && <Clock        className="w-3 h-3" />}
                  {store.status === 'SUSPENDED' && <PauseCircle  className="w-3 h-3" />}
                  {store.status === 'REJECTED'  && <XCircle      className="w-3 h-3" />}
                  {store.status}
                </span>
                {store.verifiedAt && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                    <ShieldCheck className="w-3 h-3" />
                    Verified seller
                  </span>
                )}
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
                  <Globe className="w-3 h-3" /> ezihubb.com/shops/{store.slug}
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

            {/* Action panel — super-admin actions only */}
            {role !== 'ADMIN' && (
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
                  <>
                    <button type="button" onClick={() => setModal('suspend')}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border text-secondary rounded-button hover:border-error hover:text-error transition-colors">
                      <PauseCircle className="w-4 h-4" /> Suspend
                    </button>
                    <Link href={`/stores/${store.id}/permissions`}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-border text-secondary rounded-button hover:border-primary hover:text-primary transition-colors">
                      <ShieldCheck className="w-4 h-4" /> Permissions
                    </Link>
                  </>
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
            )}
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
      {modal === 'edit' && store && (
        <StoreEditModal
          store={store}
          onClose={() => setModal(null)}
          onSaved={invalidate}
        />
      )}
    </>
  );
}
