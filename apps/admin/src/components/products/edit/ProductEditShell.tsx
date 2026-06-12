'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Copy, MoreHorizontal, Archive, Trash2, Check, AlertCircle } from 'lucide-react';
import { fmtDate } from '../../../lib/fmt';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@mlh/constants';
import {
  buildDefaultValues,
  buildCopyDefaultValues,
  extractPrismaFields,
  extractMongoFields,
  generateSku,
} from './helpers';
import type { AdminProductDto, AdminProductDetailDto, ProductEditFormValues } from './types';

// Tab components (each isolated, communicating only via shared form context)
import { PerformanceTab }     from './tabs/PerformanceTab';
import { PhotoVideoTab }      from './tabs/PhotoVideoTab';
import { ItemDetailsTab }     from './tabs/ItemDetailsTab';
import { ItemOptionsTab }     from './tabs/ItemOptionsTab';
import { PricingShippingTab } from './tabs/PricingShippingTab';
import { HowItsMadeTab }      from './tabs/HowItsMadeTab';
import { SettingsTab }        from './tabs/SettingsTab';
import { QaTab }              from './tabs/QaTab';

// ── Tab config ────────────────────────────────────────────────────────────────

const ALL_TABS = [
  { id: 'performance',      label: 'Performance'        },
  { id: 'photo-video',      label: 'Photo & Video'      },
  { id: 'item-details',     label: 'Item Details'       },
  { id: 'item-options',     label: 'Item Options'       },
  { id: 'pricing-shipping', label: 'Pricing & Shipping' },
  { id: 'how-its-made',     label: "How It's Made"      },
  { id: 'settings',         label: 'Settings'           },
  { id: 'qa',               label: 'Q&A'                },
] as const;

type TabId = (typeof ALL_TABS)[number]['id'];

// Performance tab is meaningless before the product has been published
const EDIT_TABS   = ALL_TABS;
const CREATE_TABS = ALL_TABS.filter((t) => t.id !== 'performance');

// ── MoreMenu ─────────────────────────────────────────────────────────────────

function MoreMenu({ productId }: { productId: string; slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleArchive = async () => {
    if (!confirm('Archive this listing?')) return;
    await api.patch(API_ROUTES.ADMIN.PRODUCT(productId), { isActive: false });
    router.push('/products');
  };

  const handleDelete = async () => {
    if (!confirm('Permanently delete this listing? This cannot be undone.')) return;
    await api.delete(API_ROUTES.ADMIN.PRODUCT(productId));
    router.push('/products');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-2 rounded-button border border-border text-muted hover:text-secondary hover:border-primary/40 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-card shadow-lg z-20 py-1">
            <button type="button" onClick={() => { setOpen(false); handleArchive(); }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-secondary hover:bg-muted/5 transition-colors">
              <Archive className="w-3.5 h-3.5 text-muted" /> Archive listing
            </button>
            <button type="button" onClick={() => { setOpen(false); handleDelete(); }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete listing
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

interface ProductEditShellProps {
  /** Null / undefined = create mode */
  product?: AdminProductDto | null;
  /** Null / undefined = create mode (or product has no MongoDB detail yet) */
  detail?:  AdminProductDetailDto | null;
  /**
   * Copy Product flow — when set, the shell starts in create mode but
   * pre-fills all form fields from this source product.
   * `product` must be null/undefined when this is provided.
   */
  copyFrom?:       AdminProductDto | null;
  copyFromDetail?: AdminProductDetailDto | null;
}

export function ProductEditShell({ product, detail, copyFrom, copyFromDetail }: ProductEditShellProps) {
  const router = useRouter();

  // mode: 'edit' when editing an existing product, 'create' for new + copy
  const mode    = product?.id ? 'edit' : 'create';
  // isCopy: true when pre-filling from a source product
  const isCopy  = !product?.id && !!copyFrom?.id;

  const TABS = mode === 'create' ? CREATE_TABS : EDIT_TABS;

  const [activeTab, setActiveTab] = useState<TabId>(
    mode === 'create' ? 'item-details' : 'photo-video',
  );
  const [isDirty,   setIsDirty]   = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Draft lifecycle (create mode only) ───────────────────────────────────────

  const draftIdRef   = useRef<string | null>(null);   // stable ref for cleanup
  const publishedRef = useRef(false);                  // prevent cleanup after publish
  const [draftId,       setDraftId]       = useState<string | null>(null);
  const [draftLoading,  setDraftLoading]  = useState(mode === 'create');
  const [draftInitErr,  setDraftInitErr]  = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'create') return;
    let cancelled = false;

    (async () => {
      try {
        const body = await api.post<{ id: string }>(API_ROUTES.ADMIN.PRODUCTS_DRAFT);
        const id   = body.id;
        if (!cancelled) {
          draftIdRef.current = id;
          setDraftId(id);
        }
      } catch {
        if (!cancelled) setDraftInitErr('Could not initialize the form. Please refresh the page.');
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Block browser close/refresh while a draft exists
  useEffect(() => {
    if (mode !== 'create' || !draftId) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [mode, draftId]);

  // Silently delete the draft when component unmounts (e.g. SPA navigation away)
  // Only if the product was NOT published
  useEffect(() => {
    return () => {
      if (publishedRef.current || !draftIdRef.current) return;
      // Best-effort cleanup — fire-and-forget
      api.delete(API_ROUTES.ADMIN.PRODUCT(draftIdRef.current)).catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Leave confirmation dialog state
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Build initial form values — copy pre-fills from source, otherwise empty or edit data
  const form = useForm<ProductEditFormValues>({
    defaultValues: isCopy
      ? buildCopyDefaultValues(copyFrom!, copyFromDetail)
      : buildDefaultValues(product, detail),
  });

  useEffect(() => {
    const sub = form.watch(() => { setIsDirty(true); setSaved(false); setSaveError(null); });
    return () => sub.unsubscribe();
  }, [form]);

  // ── Save — edit mode ─────────────────────────────────────────────────────────

  const handleEdit = async (data: ProductEditFormValues) => {
    await Promise.all([
      api.patch(API_ROUTES.ADMIN.PRODUCT(product!.id), extractPrismaFields(data)),
      api.put(API_ROUTES.ADMIN.PRODUCT_DETAIL(product!.id), extractMongoFields(data)),
    ]);
    setIsDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Save — create mode ───────────────────────────────────────────────────────

  const handleCreate = async (data: ProductEditFormValues) => {
    if (!draftId) throw new Error('Draft not ready — please wait or refresh.');

    if (!data.name?.trim()) {
      form.setError('name', { message: 'Title is required' });
      setActiveTab('item-details');
      throw new Error('Title is required');
    }
    if (!data.primaryCategoryId) {
      setActiveTab('item-details');
      throw new Error('Category is required');
    }

    const sku = data.sku?.trim() || generateSku();

    await api.patch(API_ROUTES.ADMIN.PRODUCT(draftId), {
      ...extractPrismaFields(data),
      name:        data.name.trim(),
      sku,
      description: data.description || '',
      basePrice:   data.basePrice   || 0,
      categoryId:  data.primaryCategoryId,
      status:      isCopy ? 'INACTIVE' : 'ACTIVE',
      isActive:    isCopy ? false : true,
    });

    // MongoDB detail (best-effort)
    await api.put(API_ROUTES.ADMIN.PRODUCT_DETAIL(draftId), { ...extractMongoFields(data), productId: draftId }).catch(() => {});

    // Attach any presigned images that arrived before publish
    const pendingUrls = data.pendingImageUrls ?? [];
    if (pendingUrls.length > 0) {
      await api.post(API_ROUTES.ADMIN.PRODUCT_IMAGES_FROM_URLS(draftId), { urls: pendingUrls }).catch(() => {});
    }

    publishedRef.current = true;             // prevent cleanup on unmount
    router.push(`/products/${draftId}/edit`);
  };

  // ── Unified save handler ──────────────────────────────────────────────────────

  const handleSave = async (data: ProductEditFormValues) => {
    setSaveError(null);
    try {
      if (mode === 'create') {
        await handleCreate(data);
      } else {
        await handleEdit(data);
      }
    } catch (e: unknown) {
      setSaveError((e as Error).message ?? 'Save failed');
    }
  };

  const handleDiscard = () => {
    if (mode === 'create' && draftId) {
      setShowLeaveDialog(true);
    } else {
      form.reset(buildDefaultValues(product, detail));
      setIsDirty(false);
      setSaveError(null);
    }
  };

  const handleDuplicate = async () => {
    if (!product?.id) return;
    const body = await api.post<{ id: string }>(`/admin/products/${product.id}/duplicate`);
    const newId = body.id;
    if (newId) router.push(`/products/${newId}/edit`);
  };

  const productName = form.watch('name') || product?.name || '';

  // Build a synthetic "product-like" object for create mode so tabs get a real ID
  const tabProduct = product ?? (draftId ? {
    id:     draftId,
    images: [],
    slug:   '',
    name:   '',
    sku:    '',
    isActive:    false,
    status:      'DRAFT' as const,
    isFeatured:  false,
    isPersonalizable: false,
    viewCount: 0,
    soldCount: 0,
    categoryId: '',
    description: '',
    basePrice:  0,
    createdAt:  new Date().toISOString(),
  } as unknown as AdminProductDto : null);

  // ── Render ────────────────────────────────────────────────────────────────────

  if (mode === 'create' && draftLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-3 text-muted">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Initializing…</p>
        </div>
      </div>
    );
  }

  if (mode === 'create' && draftInitErr) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-sm text-red-600">{draftInitErr}</p>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      {/*
        Negative margins break out of the admin layout's p-6 lg:p-8 padding
        so the sticky header/footer can span the full width of the content pane.
        minHeight accounts for the topbar (64px) only — padding is negated.
      */}
      <div className="-m-6 lg:-m-8 flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-0 border-b border-border bg-surface sticky -top-6 lg:-top-8 z-20">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted mb-3">
            {mode === 'create' && draftId ? (
              <button
                type="button"
                onClick={() => setShowLeaveDialog(true)}
                className="flex items-center gap-1 hover:text-secondary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Listings
              </button>
            ) : (
              <Link href="/products" className="flex items-center gap-1 hover:text-secondary transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Listings
              </Link>
            )}
            <span>/</span>
            <span className="text-secondary truncate max-w-[280px]">
              {mode === 'edit' ? productName : isCopy ? `Copy of ${copyFrom!.name}` : 'New listing'}
            </span>
          </div>

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              {/* "Copied from" pill — only shown in copy mode */}
              {isCopy && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                    <Copy className="w-3 h-3" />
                    Copied from:
                    <Link
                      href={`/products/${copyFrom!.id}/edit`}
                      className="font-semibold hover:underline underline-offset-2 truncate max-w-[200px]"
                    >
                      {copyFrom!.name}
                    </Link>
                  </span>
                  <span className="text-[11px] text-muted">
                    Original is unaffected · starts as draft
                  </span>
                </div>
              )}

              <h1 className="text-lg font-semibold text-secondary line-clamp-2 max-w-2xl leading-snug">
                {mode === 'create'
                  ? (productName || (isCopy ? `Copy of ${copyFrom!.name}` : 'New listing'))
                  : productName
                }
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                {mode === 'edit' && product && (
                  <>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      product.status === 'ACTIVE'   ? 'bg-green-100 text-green-700'  :
                      product.status === 'INACTIVE' ? 'bg-gray-100 text-gray-600'   :
                      product.status === 'ARCHIVED' ? 'bg-orange-100 text-orange-700' :
                                                      'bg-blue-100 text-blue-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        product.status === 'ACTIVE'   ? 'bg-green-500'  :
                        product.status === 'INACTIVE' ? 'bg-gray-400'   :
                        product.status === 'ARCHIVED' ? 'bg-orange-500' :
                                                        'bg-blue-400'
                      }`} />
                      {product.status ?? (product.isActive ? 'Active' : 'Inactive')}
                    </span>
                    <span className="text-xs text-muted">
                      Listed {fmtDate(product.publishedAt ?? product.createdAt)}
                    </span>
                    <span className="text-xs font-mono text-muted">{product.sku}</span>
                  </>
                )}
                {mode === 'create' && (
                  <span className="text-xs text-muted italic">Fill in Item Details to get started</span>
                )}
              </div>
            </div>

            {/* Header actions (edit mode only) */}
            {mode === 'edit' && product && (
              <div className="flex items-center gap-2 shrink-0">
                <a href={`/en/products/${product.slug}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-muted border border-border rounded-button px-3 py-2 hover:border-primary/40 hover:text-primary transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> View
                </a>
                <button type="button" onClick={handleDuplicate}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted border border-border rounded-button px-3 py-2 hover:border-primary/40 hover:text-primary transition-colors">
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
                <MoreMenu productId={product.id} slug={product.slug} />
              </div>
            )}
          </div>

          {/* Tab navigation */}
          <nav className="flex gap-0 -mb-px overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={[
                  'px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors shrink-0',
                  activeTab === tab.id
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted hover:text-secondary',
                ].join(' ')}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}
        {/*
          All tab components stay mounted; inactive ones are hidden with CSS.
          This preserves local state (e.g. localImages in PhotoVideoTab, open
          modals, pending uploads) when the user switches tabs.
        */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className={activeTab !== 'performance' ? 'hidden' : ''}>
            {product && <PerformanceTab product={product} />}
          </div>
          <div className={activeTab !== 'photo-video' ? 'hidden' : ''}>
            <PhotoVideoTab
              product={tabProduct ?? { id: '', images: [], slug: '' } as unknown as AdminProductDto}
            />
          </div>
          <div className={activeTab !== 'item-details' ? 'hidden' : ''}>
            <ItemDetailsTab />
          </div>
          <div className={activeTab !== 'item-options' ? 'hidden' : ''}>
            <ItemOptionsTab
              product={tabProduct ?? { id: '', images: [] } as unknown as AdminProductDto}
            />
          </div>
          <div className={activeTab !== 'pricing-shipping' ? 'hidden' : ''}>
            <PricingShippingTab
              product={tabProduct ?? { id: '' } as unknown as AdminProductDto}
              onSwitchTab={setActiveTab}
            />
          </div>
          <div className={activeTab !== 'how-its-made' ? 'hidden' : ''}>
            <HowItsMadeTab productId={tabProduct?.id ?? product?.id} />
          </div>
          <div className={activeTab !== 'settings' ? 'hidden' : ''}>
            <SettingsTab
              productId={product?.id}
              initialRelatedIds={product?.featuredRelatedIds}
            />
          </div>
          <div className={activeTab !== 'qa' ? 'hidden' : ''}>
            {(product?.id) && <QaTab productId={product.id} />}
          </div>
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────────── */}
        <div className="sticky -bottom-6 lg:-bottom-8 bg-surface border-t border-border px-6 py-3 flex items-center justify-between z-20">
          {/* Status / error message */}
          <div className="flex items-center gap-2">
            {saveError ? (
              <span className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-3.5 h-3.5" />
                {saveError}
              </span>
            ) : saved ? (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <Check className="w-3.5 h-3.5" />
                {mode === 'create' ? 'Listing created' : 'Changes saved'}
              </span>
            ) : isDirty ? (
              <span className="text-sm text-amber-600">You have unsaved changes.</span>
            ) : mode === 'create' ? (
              <span className="text-sm text-muted">Fill in at least a title and category to publish.</span>
            ) : (
              <span className="text-sm text-muted">All changes saved.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Discard — edit mode only (create has no "original" to revert to) */}
            {mode === 'edit' && (
              <button type="button" onClick={handleDiscard}
                disabled={!isDirty || form.formState.isSubmitting}
                className="px-3 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors disabled:opacity-40">
                Discard changes
              </button>
            )}

            {/* Preview — edit mode only */}
            {mode === 'edit' && product && (
              <a href={`/en/products/${product.slug}`} target="_blank" rel="noopener noreferrer"
                className="px-3 py-2 text-sm font-medium text-secondary border border-border rounded-button hover:border-primary/40 transition-colors">
                Preview
              </a>
            )}

            {/* Primary CTA */}
            <button
              type="button"
              onClick={form.handleSubmit(handleSave)}
              disabled={form.formState.isSubmitting || (mode === 'edit' && !isDirty)}
              className={[
                'flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-button transition-colors disabled:opacity-50',
                isDirty || mode === 'create'
                  ? 'bg-primary hover:bg-primary-dark text-white'
                  : 'bg-primary/20 text-primary cursor-default',
              ].join(' ')}
            >
              {form.formState.isSubmitting
                ? (mode === 'create' ? 'Creating…' : 'Saving…')
                : (mode === 'create' ? 'Create listing' : 'Publish changes')
              }
            </button>
          </div>
        </div>

        {/* Leave confirmation dialog (create mode) */}
        {showLeaveDialog && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
              <h3 className="font-semibold text-secondary">Discard this listing?</h3>
              <p className="text-sm text-muted">
                All uploaded photos and variations will be permanently deleted. This cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (draftId) {
                      await api.delete(API_ROUTES.ADMIN.PRODUCT(draftId)).catch(() => {});
                    }
                    publishedRef.current = true; // prevent double-delete on unmount
                    setShowLeaveDialog(false);
                    router.push('/products');
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-button transition-colors"
                >
                  Discard listing
                </button>
                <button
                  type="button"
                  onClick={() => setShowLeaveDialog(false)}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors"
                >
                  Keep editing
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </FormProvider>
  );
}
