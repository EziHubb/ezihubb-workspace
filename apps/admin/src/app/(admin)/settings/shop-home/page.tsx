'use client';

import { useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Camera, Pencil, Plus, X, Check, ExternalLink, Trash2, ArrowUp, ArrowDown,
  Video, ImagePlus, Star, MessageSquareHeart,
} from 'lucide-react';
import { useAdminMode } from '../../../../lib/store-context';
import { api, adminApi } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import { fmtNum } from '../../../../lib/fmt';
import { useDialog } from '../../../../contexts/DialogContext';
import { ListingPicker, type PickedProduct } from '../../../../components/marketing/ListingPicker';
import { ReloadButton } from '../../../../components/ui/ReloadButton';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShopFaq { id: string; question: string; answer: string; sortOrder: number }

interface ShopHomeStore {
  id:                 string;
  name:               string;
  slug:               string;
  logoUrl:            string | null;
  bannerUrl:          string | null;
  description:        string | null;
  tagline:            string | null;
  location:           string | null;
  colorTheme:         string | null;
  announcement:       string | null;
  announcementUpdatedAt: string | null;
  aboutHeadline:      string | null;
  aboutVideoUrl:       string | null;
  aboutPhotoUrls:     string[];
  ownerBio:           string | null;
  featuredProductIds: string[];
  followerCount:      number;
  totalOrders:        number;
  createdAt:          string;
  faqs:               ShopFaq[];
  owner:              { firstName: string | null; lastName: string | null; avatarUrl?: string | null };
}

interface ShopProductRow {
  id: string; name: string; slug: string; status: string; basePrice: number;
  images: { url: string }[];
}

interface TaxInfoLite { sellerType: 'INDIVIDUAL' | 'BUSINESS' }

const COLOR_THEMES = [
  { value: 'coral',      label: 'Coral',      swatch: '#E85D3F' },
  { value: 'periwinkle', label: 'Periwinkle', swatch: '#7C8FE0' },
  { value: 'purple',     label: 'Purple',     swatch: '#8B5FBF' },
  { value: 'forest',     label: 'Forest',     swatch: '#3F7D58' },
  { value: 'plum',       label: 'Plum',       swatch: '#8E3B5C' },
  { value: 'slate',      label: 'Slate',      swatch: '#4A5568' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-6 border-b border-border last:border-0">
      <h2 className="text-base font-bold text-secondary mb-3">{title}</h2>
      {children}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShopHomeEditorPage() {
  const { ownStoreId, isPlatformContext, isReady } = useAdminMode();
  const qc = useQueryClient();
  const { alert, confirm } = useDialog();

  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo,   setUploadingLogo]   = useState(false);
  const [editingTagline,  setEditingTagline]  = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [taglineDraft,    setTaglineDraft]    = useState('');
  const [locationDraft,   setLocationDraft]   = useState('');
  const [itemsFilter,     setItemsFilter]     = useState<'all' | 'sale'>('all');
  const [announcementDraft, setAnnouncementDraft] = useState<string | null>(null);
  const [showFeaturedPicker, setShowFeaturedPicker] = useState(false);
  const [aboutDraft, setAboutDraft] = useState<{ headline?: string } | null>(null);
  const [newFaq, setNewFaq] = useState<{ question: string; answer: string } | null>(null);
  // Add/remove both read-then-write `store.aboutPhotoUrls` from the current
  // render's closure — firing a second one before the first's refetch lands
  // would silently resurrect a just-removed photo (or drop a just-added one).
  // Serializing them via this flag closes that window without a full
  // optimistic-update rewrite.
  const [photosBusy, setPhotosBusy] = useState(false);

  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef   = useRef<HTMLInputElement>(null);
  const photoInputRef  = useRef<HTMLInputElement>(null);
  const videoInputRef  = useRef<HTMLInputElement>(null);

  const storeQuery = useQuery<ShopHomeStore>({
    queryKey: ['shop-home', ownStoreId],
    queryFn:  () => api.get<ShopHomeStore>(API_ROUTES.ADMIN.STORE(ownStoreId)),
    enabled:  isReady && !isPlatformContext && !!ownStoreId,
  });
  const store = storeQuery.data;

  const productsQuery = useQuery<{ data: ShopProductRow[] }>({
    queryKey: ['shop-home-products', ownStoreId],
    queryFn:  () => api.get(`${API_ROUTES.ADMIN.STORE_PRODUCTS(ownStoreId)}?limit=50`),
    enabled:  isReady && !isPlatformContext && !!ownStoreId,
  });

  const taxInfoQuery = useQuery<TaxInfoLite | null>({
    queryKey: ['shop-home-tax-info'],
    queryFn:  () => api.get<TaxInfoLite | null>(API_ROUTES.ADMIN.FINANCES_TAX_INFO),
    enabled:  isReady && !isPlatformContext,
  });

  const featuredQuery = useQuery<PickedProduct[]>({
    queryKey: ['shop-home-featured', store?.featuredProductIds],
    queryFn:  async () => {
      const ids = store?.featuredProductIds ?? [];
      const results = await Promise.all(ids.map((id) => api.get<PickedProduct>(API_ROUTES.ADMIN.PRODUCT(id)).catch(() => null)));
      return results.filter((p): p is PickedProduct => !!p);
    },
    enabled: !!store,
  });

  const invalidateStore = () => qc.invalidateQueries({ queryKey: ['shop-home', ownStoreId] });

  const patchStore = async (payload: Record<string, unknown>) => {
    try {
      await api.patch(API_ROUTES.ADMIN.STORE(ownStoreId), payload);
      invalidateStore();
    } catch (err) {
      await alert((err as Error).message || 'Could not save. Please try again.', { variant: 'error' });
    }
  };

  const handleUpload = async (
    file: File,
    endpoint: string,
    setLoading: (v: boolean) => void,
  ) => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await adminApi.post(endpoint, form);
      invalidateStore();
    } catch {
      await alert('Upload failed. Please try again.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const products = useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data]);
  const filteredProducts = useMemo(
    () => itemsFilter === 'all' ? products : products.filter((p) => p.status === 'ACTIVE'),
    [products, itemsFilter],
  );

  const sinceYear = store ? new Date(store.createdAt).getFullYear() : null;
  const ownerName = store ? [store.owner.firstName, store.owner.lastName].filter(Boolean).join(' ') || 'Shop owner' : '';

  // ── FAQ handlers ─────────────────────────────────────────────────────────────

  const saveFaq = async () => {
    if (!newFaq?.question.trim() || !newFaq?.answer.trim()) return;
    try {
      await api.post(API_ROUTES.ADMIN.STORE_FAQS(ownStoreId), newFaq);
      setNewFaq(null);
      invalidateStore();
    } catch (err) {
      await alert((err as Error).message || 'Could not add this FAQ.', { variant: 'error' });
    }
  };

  const deleteFaq = async (faqId: string) => {
    if (!await confirm('Delete this FAQ?', { confirmLabel: 'Delete', destructive: true })) return;
    await api.delete(API_ROUTES.ADMIN.STORE_FAQ(ownStoreId, faqId));
    invalidateStore();
  };

  const moveFaq = async (faqs: ShopFaq[], index: number, dir: -1 | 1) => {
    const next = [...faqs];
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    await api.patch(API_ROUTES.ADMIN.STORE_FAQS_REORDER(ownStoreId), { orderedIds: next.map((f) => f.id) });
    invalidateStore();
  };

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (isPlatformContext) {
    return (
      <div className="text-center py-16 border border-dashed border-border rounded-card">
        <p className="text-sm font-semibold text-secondary mb-1">Shop Home is managed per store</p>
        <p className="text-sm text-muted">Switch into a store to edit its storefront.</p>
      </div>
    );
  }

  if (!store) {
    return <div className="h-96 bg-muted/5 rounded-xl animate-pulse" />;
  }

  return (
    <div className="max-w-[900px]">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold text-secondary">Shop Home editor</h1>
        <div className="flex items-center gap-2">
          <a
            href={`${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3000'}/shops/${store.slug}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 border border-border text-secondary text-sm font-semibold rounded-pill hover:border-primary/40 transition-colors"
          >
            View on site <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <ReloadButton queryKey={['shop-home', ownStoreId]} />
        </div>
      </div>
      <p className="text-sm text-muted mb-6">Customise how your shop appears to buyers.</p>

      {/* ── Colour theme ─────────────────────────────────────────────────── */}
      <Section title="Colour theme">
        <div className="flex flex-wrap gap-2">
          {COLOR_THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => patchStore({ colorTheme: t.value })}
              className={`flex items-center gap-2 px-3 py-2 rounded-pill border-2 text-sm font-medium transition-colors ${store.colorTheme === t.value ? 'border-secondary' : 'border-border hover:border-secondary/40'}`}
            >
              <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: t.swatch }} />
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Banner + logo + name ─────────────────────────────────────────── */}
      <div className="py-6 border-b border-border">
        <div
          className="relative w-full aspect-[4/1] rounded-xl overflow-hidden bg-muted/10 border border-border cursor-pointer group"
          onClick={() => bannerInputRef.current?.click()}
        >
          {store.bannerUrl ? (
            <Image src={store.bannerUrl} alt="" fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted text-sm">No banner set</div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
              {uploadingBanner ? <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin" /> : <Camera className="w-4 h-4 text-secondary" />}
            </span>
          </div>
          <input ref={bannerInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, API_ROUTES.ADMIN.STORE_BANNER(ownStoreId), setUploadingBanner); e.target.value = ''; }} />
        </div>

        <div className="flex items-start gap-4 mt-4">
          <div
            className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted/10 border border-border shrink-0 cursor-pointer group"
            onClick={() => logoInputRef.current?.click()}
          >
            {store.logoUrl ? (
              <Image src={store.logoUrl} alt="" fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary font-bold text-lg">{store.name[0]?.toUpperCase()}</div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              {uploadingLogo ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f, API_ROUTES.ADMIN.STORE_LOGO(ownStoreId), setUploadingLogo); e.target.value = ''; }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-display text-xl font-bold text-secondary">{store.name}</p>

            {editingTagline ? (
              <div className="flex items-center gap-2 mt-1">
                <input value={taglineDraft} onChange={(e) => setTaglineDraft(e.target.value)} autoFocus maxLength={150}
                  className="flex-1 h-9 px-3 text-sm border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <button type="button" onClick={async () => { await patchStore({ tagline: taglineDraft }); setEditingTagline(false); }} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Check className="w-4 h-4" /></button>
                <button type="button" onClick={() => setEditingTagline(false)} className="p-1.5 rounded hover:bg-muted/10 text-muted"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <p className="text-sm text-muted mt-0.5 flex items-center gap-1.5">
                {store.tagline || <span className="italic">No tagline set</span>}
                <button type="button" onClick={() => { setTaglineDraft(store.tagline ?? ''); setEditingTagline(true); }} className="text-muted hover:text-primary"><Pencil className="w-3 h-3" /></button>
              </p>
            )}

            {editingLocation ? (
              <div className="flex items-center gap-2 mt-1">
                <input value={locationDraft} onChange={(e) => setLocationDraft(e.target.value)} autoFocus maxLength={150}
                  placeholder="e.g. Hai Phong, Vietnam"
                  className="flex-1 h-9 px-3 text-sm border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <button type="button" onClick={async () => { await patchStore({ location: locationDraft }); setEditingLocation(false); }} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Check className="w-4 h-4" /></button>
                <button type="button" onClick={() => setEditingLocation(false)} className="p-1.5 rounded hover:bg-muted/10 text-muted"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                {store.location || 'No location set'}
                <button type="button" onClick={() => { setLocationDraft(store.location ?? ''); setEditingLocation(true); }} className="text-muted hover:text-primary"><Pencil className="w-3 h-3" /></button>
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            {store.owner.avatarUrl ? (
              <Image src={store.owner.avatarUrl} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover ml-auto" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted/10 flex items-center justify-center text-muted text-sm font-semibold ml-auto">{ownerName[0]?.toUpperCase()}</div>
            )}
            <p className="text-xs text-muted mt-1">{ownerName}</p>
          </div>
        </div>
      </div>

      {/* ── Items ────────────────────────────────────────────────────────── */}
      <Section title="Items">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {(['all', 'sale'] as const).map((f) => (
              <button key={f} type="button" onClick={() => setItemsFilter(f)}
                className={`px-3.5 py-1.5 rounded-pill text-sm font-medium border transition-colors ${itemsFilter === f ? 'border-secondary text-secondary bg-background' : 'border-border text-muted hover:bg-background'}`}>
                {f === 'all' ? `All ${products.length}` : 'On sale'}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowFeaturedPicker(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <Plus className="w-4 h-4" /> Featured area to highlight listings
          </button>
        </div>

        {(featuredQuery.data?.length ?? 0) > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-4 pb-4 border-b border-border">
            {(featuredQuery.data ?? []).map((p) => (
              <div key={p.id} className="relative rounded-lg overflow-hidden border-2 border-primary/40 aspect-square bg-muted/10">
                {p.images?.[0]?.url && <Image src={p.images[0].url} alt={p.name} fill className="object-cover" />}
                <span className="absolute top-1.5 left-1.5 bg-primary text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Featured</span>
              </div>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <p className="text-sm text-muted text-center py-10 border border-dashed border-border rounded-card">No items to show.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {filteredProducts.slice(0, 8).map((p) => (
              <Link key={p.id} href={`/products/${p.id}/edit`} className="rounded-lg overflow-hidden border border-border bg-muted/5 aspect-square relative group">
                {p.images?.[0]?.url && <Image src={p.images[0].url} alt={p.name} fill className="object-cover" />}
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* ── Announcement ─────────────────────────────────────────────────── */}
      <Section title="Announcement">
        <p className="text-xs text-muted mb-2">
          {store.announcementUpdatedAt
            ? `Last updated on ${new Date(store.announcementUpdatedAt).toLocaleDateString()}`
            : 'Optional'}
        </p>
        <textarea
          value={announcementDraft ?? store.announcement ?? ''}
          onChange={(e) => setAnnouncementDraft(e.target.value)}
          onBlur={() => { if (announcementDraft !== null) patchStore({ announcement: announcementDraft }); }}
          rows={3}
          placeholder="Welcome to your shop! Share news, seasonal updates, or a friendly hello."
          className="w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
      </Section>

      {/* ── About ────────────────────────────────────────────────────────── */}
      <Section title={`About ${store.name}`}>
        <div className="flex items-center gap-6 mb-4 text-sm">
          <div><span className="font-bold text-secondary">{fmtNum(store.totalOrders)}</span> <span className="text-muted">Sales</span></div>
          <div><span className="text-muted">On Etsy since {sinceYear}</span></div>
        </div>

        <div className="mb-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Video and photos</p>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted text-[10px] gap-1 hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Video className="w-4 h-4" />
              {store.aboutVideoUrl ? 'Video set' : 'Add video'}
            </button>
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  const presigned = await api.post<{ presignedUrl: string; publicUrl: string }[]>(
                    API_ROUTES.ADMIN.ASSETS_PRESIGN,
                    { files: [{ name: f.name, mimeType: f.type }] },
                  );
                  await fetch(presigned[0].presignedUrl, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f });
                  await patchStore({ aboutVideoUrl: presigned[0].publicUrl });
                } catch { await alert('Upload failed. Please try again.', { variant: 'error' }); }
              }} />
            {store.aboutPhotoUrls.map((url) => (
              <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                <Image src={url} alt="" fill className="object-cover" />
                <button type="button"
                  disabled={photosBusy}
                  onClick={async () => {
                    setPhotosBusy(true);
                    try { await patchStore({ aboutPhotoUrls: store.aboutPhotoUrls.filter((u) => u !== url) }); }
                    finally { setPhotosBusy(false); }
                  }}
                  className="absolute top-1 right-1 p-0.5 bg-black/60 rounded text-white disabled:opacity-50"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {store.aboutPhotoUrls.length < 5 && (
              <button type="button" disabled={photosBusy} onClick={() => photoInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted hover:border-primary/40 hover:text-primary transition-colors gap-1 disabled:opacity-50">
                <ImagePlus className="w-4 h-4" />
                <span className="text-[10px]">Add photo</span>
              </button>
            )}
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                setPhotosBusy(true);
                try {
                  const presigned = await api.post<{ presignedUrl: string; publicUrl: string }[]>(
                    API_ROUTES.ADMIN.ASSETS_PRESIGN,
                    { files: [{ name: f.name, mimeType: f.type }] },
                  );
                  await fetch(presigned[0].presignedUrl, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f });
                  await patchStore({ aboutPhotoUrls: [...store.aboutPhotoUrls, presigned[0].publicUrl] });
                } catch { await alert('Upload failed. Please try again.', { variant: 'error' }); }
                finally { setPhotosBusy(false); }
              }} />
          </div>
        </div>

        {aboutDraft !== null ? (
          <div className="flex items-center gap-2 mb-3">
            <input value={aboutDraft.headline ?? ''} onChange={(e) => setAboutDraft({ headline: e.target.value })} autoFocus maxLength={150}
              placeholder="Add a headline"
              className="flex-1 h-9 px-3 text-sm border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <button type="button" onClick={async () => { await patchStore({ aboutHeadline: aboutDraft.headline }); setAboutDraft(null); }} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Check className="w-4 h-4" /></button>
            <button type="button" onClick={() => setAboutDraft(null)} className="p-1.5 rounded hover:bg-muted/10 text-muted"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setAboutDraft({ headline: store.aboutHeadline ?? '' })}
            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline mb-3">
            <Plus className="w-4 h-4" /> {store.aboutHeadline || 'Add a headline'}
          </button>
        )}

        <p className="text-sm text-secondary whitespace-pre-line mb-3">
          {store.description || <span className="text-muted italic">Add your story. Tell shoppers a little about your business.</span>}
        </p>
        <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
          {store.description ? 'Edit your story' : 'Add your story'} →
        </Link>
      </Section>

      {/* ── Shop members ─────────────────────────────────────────────────── */}
      <Section title="Shop members">
        <div className="flex items-start gap-3">
          {store.owner.avatarUrl ? (
            <Image src={store.owner.avatarUrl} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted/10 flex items-center justify-center text-muted text-sm font-semibold shrink-0">{ownerName[0]?.toUpperCase()}</div>
          )}
          <div className="flex-1">
            <p className="text-sm font-semibold text-secondary">{ownerName}</p>
            <textarea
              defaultValue={store.ownerBio ?? ''}
              onBlur={(e) => { if (e.target.value !== (store.ownerBio ?? '')) patchStore({ ownerBio: e.target.value }); }}
              rows={2}
              placeholder="Add a personal bio with some fun facts about yourself"
              className="w-full mt-1.5 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </div>
      </Section>

      {/* ── Shop policies ────────────────────────────────────────────────── */}
      <Section title="Shop policies">
        <div className="bg-hero-periwinkle rounded-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-secondary">Set up simple shop policies</p>
            <p className="text-xs text-secondary/70 mt-0.5">We&apos;ll give you a quick template to create your shop policies in seconds.</p>
          </div>
          <Link href="/products" className="shrink-0 px-4 py-2 bg-secondary hover:bg-secondary/90 text-white text-sm font-bold rounded-pill transition-colors">
            Try it now
          </Link>
        </div>
      </Section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Section title="Frequently asked questions">
        <p className="text-xs text-muted mb-3">Information in your FAQs may not contradict Etsy&apos;s policies or your own shop policies.</p>
        {store.faqs.length > 0 && (
          <div className="space-y-2 mb-3">
            {store.faqs.map((f, i) => (
              <div key={f.id} className="border border-border rounded-lg p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-secondary">{f.question}</p>
                    <p className="text-xs text-muted mt-0.5">{f.answer}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button type="button" onClick={() => moveFaq(store.faqs, i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted/10 text-muted disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => moveFaq(store.faqs, i, 1)} disabled={i === store.faqs.length - 1} className="p-1 rounded hover:bg-muted/10 text-muted disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => deleteFaq(f.id)} className="p-1 rounded hover:bg-red-50 text-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {newFaq ? (
          <div className="border border-border rounded-lg p-3.5 space-y-2">
            <input value={newFaq.question} onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })} placeholder="Question" autoFocus
              className="w-full h-9 px-3 text-sm border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <textarea value={newFaq.answer} onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })} placeholder="Answer" rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="flex gap-2">
              <button type="button" onClick={saveFaq} className="px-3.5 py-1.5 bg-primary text-white text-sm font-semibold rounded-pill">Save</button>
              <button type="button" onClick={() => setNewFaq(null)} className="px-3.5 py-1.5 border border-border text-secondary text-sm font-medium rounded-pill">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setNewFaq({ question: '', answer: '' })} className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <Plus className="w-4 h-4" /> Add an FAQ
          </button>
        )}
      </Section>

      {/* ── Seller details ───────────────────────────────────────────────── */}
      <Section title="Seller details">
        <p className="text-sm font-semibold text-secondary mb-1">Your seller status in the EU</p>
        <p className="text-xs text-muted mb-2 max-w-xl">
          If you&apos;re an incorporated business on Etsy, you&apos;re likely considered a professional seller in the EU (known as a trader).
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-secondary">
            Status: <span className="font-semibold">{taxInfoQuery.data?.sellerType === 'BUSINESS' ? 'Incorporated business' : 'Private individual'}</span>
          </span>
          <Link href="/finances/tax-information" className="text-sm font-semibold text-primary hover:underline">Edit</Link>
        </div>
      </Section>

      {/* ── Featured picker ──────────────────────────────────────────────── */}
      {showFeaturedPicker && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowFeaturedPicker(false)}>
          <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-secondary flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Featured area</h4>
              <button type="button" onClick={() => setShowFeaturedPicker(false)} className="p-1.5 rounded hover:bg-muted/10 text-muted"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-muted mb-3">Pin up to 4 listings to highlight at the top of your shop.</p>
            <ListingPicker
              selected={featuredQuery.data ?? []}
              max={4}
              onChange={(picked) => patchStore({ featuredProductIds: picked.map((p) => p.id) })}
            />
            <div className="flex justify-end mt-4">
              <button type="button" onClick={() => setShowFeaturedPicker(false)} className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-pill">Done</button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted flex items-center gap-1.5 py-4">
        <MessageSquareHeart className="w-3.5 h-3.5" /> {fmtNum(store.followerCount)} admirer{store.followerCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
