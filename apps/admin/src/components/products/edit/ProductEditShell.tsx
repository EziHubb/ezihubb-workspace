'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDialog } from '../../../contexts/DialogContext';
import { useForm, FormProvider } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Copy, MoreHorizontal, Archive, Trash2, Check, AlertCircle } from 'lucide-react';
import { fmtDate } from '../../../lib/fmt';
import { api } from '../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';
import {
  buildDefaultValues,
  buildCopyDefaultValues,
  extractPrismaFields,
  extractMongoFields,
  fromPendingImageRef,
  generateSku,
} from './helpers';
import type { AdminProductDto, AdminProductDetailDto, ApplyVariationsPayload, ProductEditFormValues } from './types';

import { PhotoVideoTab }      from './tabs/PhotoVideoTab';
import { ItemDetailsTab }     from './tabs/ItemDetailsTab';
import { ItemOptionsTab }     from './tabs/ItemOptionsTab';
import { ListingImagesProvider } from './ListingImagesContext';
import { PricingShippingTab } from './tabs/PricingShippingTab';
import { HowItsMadeTab }      from './tabs/HowItsMadeTab';
import { SettingsTab }        from './tabs/SettingsTab';
import { FulfillmentTab }     from './tabs/FulfillmentTab';
import { DigitalFilesTab }    from './tabs/DigitalFilesTab';
import { QaTab }              from './tabs/QaTab';

// ── Tab config ────────────────────────────────────────────────────────────────

const ALL_TABS = [
  { id: 'photo-video',      label: 'Photo & Video'      },
  { id: 'item-details',     label: 'Item Details'       },
  { id: 'item-options',     label: 'Item Options'       },
  { id: 'pricing-shipping', label: 'Pricing & Shipping' },
  { id: 'how-its-made',     label: "How It's Made"      },
  { id: 'fulfillment',      label: 'Fulfillment'        },
  { id: 'digital-files',    label: 'Digital Files'      },
  { id: 'customer-qa',      label: 'Customer Q&A'       },
  { id: 'settings',         label: 'Settings'           },
] as const;

type TabId = (typeof ALL_TABS)[number]['id'];

// Fulfillment mapping and digital-files upload both need a real product id —
// hidden until the listing is saved once. how-its-made/fulfillment are
// physical-only; digital-files is digital-only — filtered per productType below.
function tabsFor(mode: 'create' | 'edit', productType: 'PHYSICAL' | 'DIGITAL'): typeof ALL_TABS[number][] {
  return ALL_TABS.filter((t) => {
    if (mode === 'create' && (t.id === 'fulfillment' || t.id === 'digital-files' || t.id === 'customer-qa')) return false;
    if (productType === 'DIGITAL' && (t.id === 'how-its-made' || t.id === 'fulfillment')) return false;
    if (productType === 'PHYSICAL' && t.id === 'digital-files') return false;
    return true;
  });
}

// ── MoreMenu ─────────────────────────────────────────────────────────────────

function MoreMenu({ productId }: { productId: string; slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { confirm } = useDialog();

  const handleArchive = async () => {
    if (!await confirm('Archive this listing?', { confirmLabel: 'Archive', destructive: true })) return;
    await api.patch(API_ROUTES.ADMIN.PRODUCT(productId), { isActive: false });
    router.push('/products');
  };

  const handleDelete = async () => {
    if (!await confirm('Permanently delete this listing? This cannot be undone.', { confirmLabel: 'Delete', destructive: true })) return;
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
  product?: AdminProductDto | null;
  detail?:  AdminProductDetailDto | null;
  copyFrom?:       AdminProductDto | null;
  copyFromDetail?: AdminProductDetailDto | null;
  copyVariationDraft?: ApplyVariationsPayload | null;
}

export function ProductEditShell({ product, detail, copyFrom, copyFromDetail, copyVariationDraft }: ProductEditShellProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mode   = product?.id ? 'edit' : 'create';
  const isCopy = !product?.id && !!copyFrom?.id;

  const form = useForm<ProductEditFormValues>({
    defaultValues: isCopy && copyFrom
      ? buildCopyDefaultValues(copyFrom, copyFromDetail, copyVariationDraft)
      : buildDefaultValues(product, detail),
  });
  const productType = form.watch('productType') ?? 'PHYSICAL';
  const TABS = tabsFor(mode, productType);

  const [activeTab,  setActiveTab]  = useState<TabId>(ALL_TABS[0].id);
  /**
   * Straight from react-hook-form, which diffs the live values against
   * `defaultValues` — so putting a field back the way it was clears it again.
   * The baseline is set at mount above and re-set by `form.reset()` after a
   * save or a discard.
   */
  const { isDirty } = form.formState;
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);

  // ── Scroll-spy ───────────────────────────────────────────────────────────────
  // The actual scroll container is <main> in the admin layout (overflow-y-auto),
  // not an inner div. We locate it once on mount and attach everything to it.

  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  const scrollAreaRef  = useRef<HTMLDivElement>(null);
  const headerRef      = useRef<HTMLDivElement>(null);
  const sectionRefs    = useRef<Partial<Record<TabId, HTMLDivElement | null>>>({});
  const isScrollingRef = useRef(false);

  // The shell owns its own scroll region (see the outer `overflow-y-auto` div
  // below) instead of relying on the admin layout's <main> — the nav's sticky
  // containing block needs to span the FULL scrollable content, and reaching
  // across a negative-margin-bled boundary into an ancestor scroll container
  // was exactly what made the tab nav/footer fail to stay pinned.
  //
  // A callback ref, not a mount effect. In create mode this component returns
  // an "Initializing…" block while the draft is being set up, so the scroll
  // region is not in the tree on first mount: a `useEffect(…, [])` read a null
  // ref, stored null, and never ran again. scrollToSection() bails out when
  // the container is null, which is why every tab in the New listing page was
  // inert while the same tabs worked fine when editing an existing listing.
  const attachScrollArea = useCallback((el: HTMLDivElement | null) => {
    scrollAreaRef.current = el;
    setScrollContainer(el);
  }, []);

  const scrollToSection = useCallback((id: TabId) => {
    if (!scrollContainer) return;
    const el = sectionRefs.current[id];
    if (!el) return;
    setActiveTab(id);
    isScrollingRef.current = true;
    const headerHeight = headerRef.current?.offsetHeight ?? 120;
    const top =
      el.getBoundingClientRect().top -
      scrollContainer.getBoundingClientRect().top +
      scrollContainer.scrollTop -
      headerHeight -
      8;
    scrollContainer.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    // Re-enable spy after smooth scroll finishes (~600 ms)
    setTimeout(() => { isScrollingRef.current = false; }, 650);
  }, [scrollContainer]);

  // Central Questions links directly to this section. The editor scrolls an
  // inner container, so native hash scrolling is not reliable enough on its
  // own after the async product data and sticky header have mounted.
  useEffect(() => {
    if (mode !== 'edit' || !scrollContainer) return;
    if (window.location.hash !== '#customer-qa') return;
    const frame = window.requestAnimationFrame(() =>
      scrollToSection('customer-qa'),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [mode, scrollContainer, scrollToSection]);

  useEffect(() => {
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (isScrollingRef.current) return;
      const containerTop  = scrollContainer.getBoundingClientRect().top;
      const headerHeight  = headerRef.current?.offsetHeight ?? 120;
      // Highlight the last section whose top edge passed just below the sticky header
      const threshold = containerTop + headerHeight + 32;
      let active: TabId = TABS[0].id;
      for (const { id } of TABS) {
        const el = sectionRefs.current[id];
        if (!el) continue;
        if (el.getBoundingClientRect().top <= threshold) active = id;
      }
      setActiveTab(active);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [scrollContainer, TABS]);

  // ── Local edit lifecycle and explicit draft persistence ──────────────────────

  const pendingProductIdRef = useRef<string | null>(null);
  const navigatingRef = useRef(false);
  const attachedImageIdsRef = useRef(new Map<string, string>());
  const deletedImageIdsRef = useRef(new Set<string>());
  const attachedVideoUrlsRef = useRef(new Set<string>());
  const deletedVideoUrlsRef = useRef(new Set<string>());
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState('/products');
  const hasUnsavedWork = isDirty || (mode === 'create' && isCopy);

  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (navigatingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedWork]);

  useEffect(() => {
    if (!hasUnsavedWork) return;
    const interceptNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const target = `${destination.pathname}${destination.search}${destination.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (target === current) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTarget(target);
      setShowLeaveDialog(true);
    };
    document.addEventListener('click', interceptNavigation, true);
    return () => document.removeEventListener('click', interceptNavigation, true);
  }, [hasUnsavedWork]);

  /**
   * Clears the "Saved" flag once the seller starts editing again.
   *
   * Dirtiness is NOT tracked here any more. This used to also call
   * setIsDirty(true), which made it a one-way latch: `form.watch` fires on
   * every keystroke and the handler never compared anything, so touching a
   * field once left the form marked dirty for the rest of its life. Choosing
   * "Digital download" and then choosing "Physical product" again put every
   * value back exactly as loaded, and the footer still insisted there were
   * unsaved changes.
   *
   * react-hook-form already answers this properly — `formState.isDirty`
   * compares the live values against `defaultValues` and goes back to false
   * when they match again.
   */
  useEffect(() => {
    const sub = form.watch(() => { setSaved(false); setSaveError(null); });
    return () => sub.unsubscribe();
  }, [form]);

  const commitStagedChanges = async (productId: string, data: ProductEditFormValues) => {
    await api.patch(API_ROUTES.ADMIN.PRODUCT_RELATED(productId), {
      ids: data.relatedProductIds ?? [],
    });

    const originalImageIds = new Set(
      (product?.images ?? []).filter((image) => image.type === 'MOCKUP').map((image) => image.id),
    );
    const keptImageIds = data.imageIds ?? [];
    const keptSet = new Set(keptImageIds);
    for (const id of [...originalImageIds].filter((candidate) => !keptSet.has(candidate))) {
      if (deletedImageIdsRef.current.has(id)) continue;
      await api.delete(API_ROUTES.ADMIN.PRODUCT_IMAGE(productId, id));
      deletedImageIdsRef.current.add(id);
    }

    const pendingImageUrls = data.pendingImageUrls ?? [];
    const urlsToAttach = pendingImageUrls.filter((url) => !attachedImageIdsRef.current.has(url));
    if (urlsToAttach.length) {
      const attached = await api.post<{ id: string }[]>(
        API_ROUTES.ADMIN.PRODUCT_IMAGES_FROM_URLS(productId),
        { urls: urlsToAttach },
      );
      attached.forEach((image, index) => attachedImageIdsRef.current.set(urlsToAttach[index], image.id));
    }
    const imageOrder = data.imageOrder?.length
      ? data.imageOrder
      : [...keptImageIds, ...pendingImageUrls.map((url) => `pending:${url}`)];
    const imageIdForRef = (ref: string) => {
      const pendingUrl = fromPendingImageRef(ref);
      return pendingUrl ? attachedImageIdsRef.current.get(pendingUrl) : ref;
    };
    const orderedImageIds = imageOrder
      .map(imageIdForRef)
      .filter((id): id is string => !!id);
    if (orderedImageIds.length) {
      await api.patch(API_ROUTES.ADMIN.PRODUCT_IMAGES_REORDER(productId), {
        orderedIds: orderedImageIds,
      });
    }

    const imageAltTexts = Object.fromEntries(
      Object.entries(data.imageAltTexts ?? {}).map(([ref, text]) => [imageIdForRef(ref) ?? ref, text]),
    );
    const committedData = {
      ...data,
      imageIds: orderedImageIds,
      imageOrder: orderedImageIds,
      imageAltTexts,
      pendingImageUrls: [],
      variationDraft: null,
    };

    if (data.variationDraft) {
      const variationDraft: ApplyVariationsPayload = {
        ...data.variationDraft,
        groups: data.variationDraft.groups.map((group) => ({
          ...group,
          options: group.options.map((option) => ({
            ...option,
            imageId: option.imageId ? imageIdForRef(option.imageId) ?? null : null,
          })),
        })),
      };
      await api.post(API_ROUTES.ADMIN.PRODUCT_VARIATIONS_APPLY(productId), variationDraft);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['variation-groups', productId] }),
        queryClient.invalidateQueries({ queryKey: ['variation-settings', productId] }),
        queryClient.invalidateQueries({ queryKey: ['product-variant-list', productId] }),
      ]);
    }
    await api.put(API_ROUTES.ADMIN.PRODUCT_DETAIL(productId), extractMongoFields(committedData));

    const originalVideos = product?.videoUrls ?? [];
    const nextVideos = data.videoUrls ?? [];
    for (const url of originalVideos.filter((candidate) => !nextVideos.includes(candidate))) {
      if (deletedVideoUrlsRef.current.has(url)) continue;
      await api.delete(API_ROUTES.ADMIN.PRODUCT_VIDEOS(productId), { data: { url } });
      deletedVideoUrlsRef.current.add(url);
    }
    for (const url of nextVideos.filter((candidate) => !originalVideos.includes(candidate))) {
      if (attachedVideoUrlsRef.current.has(url)) continue;
      await api.post(API_ROUTES.ADMIN.PRODUCT_VIDEO_FROM_URL(productId), { url });
      attachedVideoUrlsRef.current.add(url);
    }
    return committedData;
  };

  const validatePublish = (data: ProductEditFormValues) => {
    if (!data.name?.trim()) {
      form.setError('name', { message: 'Title is required' });
      scrollToSection('item-details');
      throw new Error('Title is required');
    }
    if (!data.primaryCategoryId) {
      scrollToSection('item-details');
      throw new Error('Category is required');
    }
    if (!(Number(data.basePrice) > 0)) {
      scrollToSection('pricing-shipping');
      throw new Error('Price must be greater than 0');
    }
    if (data.productType !== 'DIGITAL' && !data.processingProfileId) {
      scrollToSection('pricing-shipping');
      throw new Error('Set a processing profile before publishing this listing');
    }
    if (data.productType !== 'DIGITAL' && !data.shippingProfileId) {
      scrollToSection('pricing-shipping');
      throw new Error('Select a delivery option before publishing this listing');
    }
  };

  const draftSafeFields = (data: ProductEditFormValues, sku: string) => {
    const fields = { ...extractPrismaFields(data), sku, isActive: false } as Record<string, unknown>;
    if (!data.name?.trim()) delete fields.name;
    else fields.name = data.name.trim();
    if (!data.description?.trim()) delete fields.description;
    if (!data.primaryCategoryId) delete fields.categoryId;
    if (!(Number(data.basePrice) > 0)) delete fields.basePrice;
    if (data.compareAtPrice != null && !(Number(data.compareAtPrice) > 0)) delete fields.compareAtPrice;
    return fields;
  };

  const persistNewListing = async (
    data: ProductEditFormValues,
    publish: boolean,
    navigateTarget?: string,
  ) => {
    if (publish) validatePublish(data);
    const sku = data.sku?.trim() || generateSku();
    const savedData = { ...data, sku };
    let productId = pendingProductIdRef.current;
    if (!productId) {
      const draft = await api.post<{ id: string }>(API_ROUTES.ADMIN.PRODUCTS_DRAFT);
      productId = draft.id;
      pendingProductIdRef.current = productId;
    }

    await api.patch(
      API_ROUTES.ADMIN.PRODUCT(productId),
      publish
        ? { ...extractPrismaFields(savedData), name: savedData.name.trim(), sku, isActive: false }
        : draftSafeFields(savedData, sku),
    );
    const committedData = await commitStagedChanges(productId, savedData);
    if (publish) await api.patch(API_ROUTES.ADMIN.PRODUCT(productId), { isActive: true });

    form.reset(committedData);
    navigatingRef.current = true;
    router.push(navigateTarget ?? `/products/${productId}/edit`);
    return productId;
  };

  // ── Save — edit mode ─────────────────────────────────────────────────────────

  const handleEdit = async (data: ProductEditFormValues) => {
    if (!product?.id) throw new Error('Product is not available');
    const productId = product.id;
    const publishingDraft = product?.status === 'DRAFT';

    if (publishingDraft) validatePublish(data);
    // Published listings must always carry their own delivery info — the
    // backend enforces this too (merged against whatever's already stored),
    // but checking client-side first avoids a round-trip and scrolls the
    // seller straight to the field that needs fixing.
    if ((product?.isActive || publishingDraft) && data.productType !== 'DIGITAL' && !data.processingProfileId) {
      scrollToSection('pricing-shipping');
      throw new Error('Set a processing profile before saving this listing');
    }
    if ((product?.isActive || publishingDraft) && data.productType !== 'DIGITAL' && !data.shippingProfileId) {
      scrollToSection('pricing-shipping');
      throw new Error('Select a delivery option before saving this listing');
    }

    // Draft rows start with a temporary DRAFT-* SKU. Once the seller reopens
    // one, this shell is in edit mode, so the create-only replacement no
    // longer runs. Publishing a saved draft must replace that placeholder.
    const sku = publishingDraft && (!data.sku?.trim() || /^DRAFT-/i.test(data.sku))
      ? generateSku()
      : data.sku;
    const savedData = { ...data, sku };

    await api.patch(API_ROUTES.ADMIN.PRODUCT(productId), {
      ...extractPrismaFields(savedData),
      ...(publishingDraft ? { isActive: false } : {}),
    });
    const committedData = await commitStagedChanges(productId, savedData);
    if (publishingDraft) {
      await api.patch(API_ROUTES.ADMIN.PRODUCT(productId), { isActive: true });
    }
    // Re-baseline rather than clearing a flag: what was just saved IS the new
    // "no unsaved changes" state, so `isDirty` must be measured against it. A
    // bare flag reset would have gone true again on the next keystroke even if
    // the seller typed the saved value back.
    form.reset(committedData);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 3000);
  };

  // ── Save — create mode ───────────────────────────────────────────────────────

  const handleCreate = async (data: ProductEditFormValues) => {
    await persistNewListing(data, true);
  };

  // ── Unified save handler ──────────────────────────────────────────────────────

  const handleSave = async (data: ProductEditFormValues) => {
    setSaveError(null);
    try {
      if (mode === 'create') await handleCreate(data);
      else                   await handleEdit(data);
    } catch (e: unknown) {
      setSaveError((e as Error).message ?? 'Save failed');
    }
  };

  const handleDiscard = () => {
    form.reset(isCopy && copyFrom
      ? buildCopyDefaultValues(copyFrom, copyFromDetail, copyVariationDraft)
      : buildDefaultValues(product, detail));
    setSaveError(null);
  };

  const handleDuplicate = () => {
    if (!product?.id) return;
    router.push(`/products/copy/${product.id}`);
  };

  const productName = form.watch('name') || product?.name || '';

  const requestLeave = (target = '/products') => {
    if (hasUnsavedWork) {
      setLeaveTarget(target);
      setShowLeaveDialog(true);
      return;
    }
    navigatingRef.current = true;
    router.push(target);
  };

  const tabProduct = product ?? {
    id: '', images: [], slug: '', name: '', sku: '', isActive: false,
    status: 'DRAFT' as const, isFeatured: false, isPersonalizable: false,
    viewCount: 0, soldCount: 0, categoryId: '', description: '', basePrice: 0,
    createdAt: new Date().toISOString(),
  } as unknown as AdminProductDto;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <FormProvider {...form}>
      {/* Inside the form provider because useListingImages() resolves the
          `imageIds` field; seeded from the server snapshot, then topped up by
          whatever the Photo & Video tab attaches during the session. */}
      <ListingImagesProvider
        key={(product?.images ?? []).map((image) => image.id).join('|')}
        initialImages={product?.images ?? []}
      >
      {/* h-full alone leaves a gap at the bottom equal to 2× the parent's
          padding: the negative margin shifts this box up to bleed into
          <main>'s padding, but margin never changes an element's own height,
          so a plain 100% falls short by exactly what the top margin ate.
          calc(100% + 2×padding) grows the box by that same amount so its
          bottom edge actually reaches <main>'s true bottom edge — matching
          <main>'s own `p-4 lg:p-8` this negative margin is undoing. */}
      <div className="-m-4 lg:-m-8 flex flex-col h-[calc(100%+2rem)] lg:h-[calc(100%+4rem)]">

        {/* ── Scroll region ─────────────────────────────────────────────────── */}
        {/* Owns its own scrollbar so the tab nav's sticky containing block spans
            the full height (breadcrumb+title+nav+all sections) instead of just
            the short header wrapper — that mismatch was why the nav detached
            and scrolled away instead of staying pinned. */}
        <div ref={attachScrollArea} className="flex-1 min-h-0 overflow-y-auto">

          {/* Breadcrumb + title scroll away with the page; only the tab strip below stays pinned — matches Etsy's Shop Manager listing editor. */}
          <div className="bg-surface">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted px-6 pt-5 mb-3">
              <button type="button" onClick={() => requestLeave('/products')}
              className="flex items-center gap-1 hover:text-secondary transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Listings
            </button>
            <span>/</span>
            <span className="text-secondary truncate max-w-[280px]">
              {mode === 'edit' ? productName : isCopy ? `Copy of ${copyFrom!.name}` : 'New listing'}
            </span>
          </div>

          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-3 px-6">
            <div className="min-w-0">
              {isCopy && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                    <Copy className="w-3 h-3" />
                    Copied from:
                    <Link href={`/products/${copyFrom!.id}/edit`}
                      className="font-semibold hover:underline underline-offset-2 truncate max-w-[200px]">
                      {copyFrom!.name}
                    </Link>
                  </span>
                  <span className="text-[11px] text-muted">Original is unaffected · starts as draft</span>
                </div>
              )}

              <h1 className="text-lg font-semibold text-secondary line-clamp-2 max-w-2xl leading-snug">
                {mode === 'create'
                  ? (productName || (isCopy ? `Copy of ${copyFrom!.name}` : 'New listing'))
                  : productName}
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                {mode === 'edit' && product && (
                  <>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      product.status === 'ACTIVE'   ? 'bg-green-100 text-green-700'    :
                      product.status === 'INACTIVE' ? 'bg-gray-100 text-gray-600'     :
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
                    <span className="text-xs text-muted">Listed {fmtDate(product.publishedAt ?? product.createdAt)}</span>
                    <span className="text-xs font-mono text-muted">{product.sku}</span>
                  </>
                )}
                {mode === 'create' && (
                  <span className="text-xs text-muted italic">Fill in Item Details to get started</span>
                )}
              </div>
            </div>

            {mode === 'edit' && product && (
              <div className="flex items-center gap-2 shrink-0">
                <a href={`${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3000'}/products/${product.slug}`} target="_blank" rel="noopener noreferrer"
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
        </div>

        {/* Section nav (scroll-spy) — a direct child of the scroll region (not
            nested inside the short header block above) so its sticky containing
            block spans the full scrollable height and it stays pinned to top
            all the way through the sections below, instead of detaching the
            moment the short header block scrolls past. */}
        <nav
          ref={headerRef}
          className="flex gap-0 px-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-border bg-surface sticky top-0 z-20"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => scrollToSection(tab.id)}
              className={[
                'px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors shrink-0',
                activeTab === tab.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted hover:text-secondary',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* ── Sections ─────────────────────────────────────────────────────── */}
        <div className="flex-1 bg-background">

          {/* Photo & Video */}
          <div ref={(el) => { sectionRefs.current['photo-video'] = el; }}>
            <PhotoVideoTab
              product={tabProduct ?? { id: '', images: [], slug: '' } as unknown as AdminProductDto}
            />
          </div>
          <div className="h-px bg-border" />

          {/* Item Details */}
          <div ref={(el) => { sectionRefs.current['item-details'] = el; }}>
            <ItemDetailsTab />
          </div>
          <div className="h-px bg-border" />

          {/* Item Options */}
          <div ref={(el) => { sectionRefs.current['item-options'] = el; }}>
            <ItemOptionsTab
              product={tabProduct ?? { id: '', images: [] } as unknown as AdminProductDto}
            />
          </div>
          <div className="h-px bg-border" />

          {/* Pricing & Shipping */}
          <div ref={(el) => { sectionRefs.current['pricing-shipping'] = el; }}>
            <PricingShippingTab
              product={tabProduct ?? { id: '' } as unknown as AdminProductDto}
              onSwitchTab={scrollToSection}
              isDigital={productType === 'DIGITAL'}
            />
          </div>
          <div className="h-px bg-border" />

          {/* How It's Made — physical-only */}
          {productType === 'PHYSICAL' && (
            <>
              <div ref={(el) => { sectionRefs.current['how-its-made'] = el; }}>
                <HowItsMadeTab />
              </div>
              <div className="h-px bg-border" />
            </>
          )}

          {/* Fulfillment — physical-only, needs a real product id */}
          {mode === 'edit' && productType === 'PHYSICAL' && (
            <>
              <div ref={(el) => { sectionRefs.current['fulfillment'] = el; }}>
                <FulfillmentTab
                productId={tabProduct?.id ?? product?.id}
                storeId={tabProduct?.storeId ?? product?.storeId}
                images={tabProduct?.images ?? []}
              />
              </div>
              <div className="h-px bg-border" />
            </>
          )}

          {/* Digital Files — digital-only, needs a real product id */}
          {mode === 'edit' && productType === 'DIGITAL' && (
            <>
              <div ref={(el) => { sectionRefs.current['digital-files'] = el; }}>
                <DigitalFilesTab productId={tabProduct?.id ?? product?.id} digitalFiles={tabProduct?.digitalFiles ?? []} />
              </div>
              <div className="h-px bg-border" />
            </>
          )}

          {/* Customer Q&A — existing listings only */}
          {mode === 'edit' && product?.id && (
            <>
              <div
                id="customer-qa"
                ref={(el) => { sectionRefs.current['customer-qa'] = el; }}
              >
                <QaTab productId={product.id} />
              </div>
              <div className="h-px bg-border" />
            </>
          )}

          {/* Settings */}
          <div ref={(el) => { sectionRefs.current['settings'] = el; }}>
            <SettingsTab
              productId={product?.id}
              initialRelatedIds={product?.featuredRelatedIds}
            />
          </div>

          {/* Bottom breathing room */}
          <div className="h-16" />
        </div>
        </div>
        {/* ── end scroll region ────────────────────────────────────────────── */}

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        {/* A plain flex sibling OUTSIDE the scroll region, not `position: sticky`
            — since it's the last item in the fixed-height flex column, it's
            always flush against the bottom with no containing-block ambiguity. */}
        <div className="shrink-0 bg-surface border-t border-border px-6 py-3 flex items-center justify-between z-20">
          <div className="flex items-center gap-4">
            {mode === 'create' && (
              <button
                type="button"
                onClick={() => requestLeave('/products')}
                className="text-sm font-medium text-muted hover:text-secondary transition-colors"
              >
                Cancel
              </button>
            )}
            {saveError ? (
              <span className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-3.5 h-3.5" /> {saveError}
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
              <span className="text-sm text-muted">You have no unsaved changes.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {mode === 'edit' && (
              <button type="button" onClick={handleDiscard}
                disabled={!isDirty || form.formState.isSubmitting}
                className="px-3 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors disabled:opacity-40">
                Discard changes
              </button>
            )}

            {mode === 'edit' && product && (
              <a href={`${process.env.NEXT_PUBLIC_CLIENT_URL ?? 'http://localhost:3000'}/products/${product.slug}`} target="_blank" rel="noopener noreferrer"
                className="px-3 py-2 text-sm font-medium text-secondary border border-border rounded-button hover:border-primary/40 transition-colors">
                Preview
              </a>
            )}

            <button
              type="button"
              onClick={form.handleSubmit(handleSave)}
              disabled={form.formState.isSubmitting || (mode === 'edit' && !isDirty && product?.status !== 'DRAFT')}
              className={[
                'flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-button transition-colors disabled:opacity-50',
                isDirty || mode === 'create'
                  ? 'bg-primary hover:bg-primary-dark text-white'
                  : 'bg-primary/20 text-primary cursor-default',
              ].join(' ')}
            >
              {form.formState.isSubmitting
                ? (mode === 'create' ? 'Creating…' : product?.status === 'DRAFT' ? 'Publishing…' : 'Saving…')
                : (mode === 'create' ? 'Create listing' : product?.status === 'DRAFT' ? 'Publish listing' : 'Publish changes')}
            </button>
          </div>
        </div>

        {/* Leave confirmation dialog */}
        {showLeaveDialog && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-sm p-6 space-y-4">
              <h3 className="font-semibold text-secondary text-lg">
                {mode === 'create' ? 'Save this draft?' : 'Discard changes?'}
              </h3>
              <p className="text-sm text-muted">
                You will lose your changes if you continue without saving.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveDialog(false)}
                  className="px-4 py-2.5 text-sm font-medium text-muted hover:text-secondary transition-colors"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigatingRef.current = true;
                    setShowLeaveDialog(false);
                    router.push(leaveTarget);
                  }}
                  className="px-5 py-2.5 bg-secondary hover:bg-secondary/90 text-white text-sm font-semibold rounded-button transition-colors"
                >
                  Discard
                </button>
                {mode === 'create' && (
                  <button
                    type="button"
                    disabled={savingDraft}
                    onClick={async () => {
                      setSavingDraft(true);
                      setSaveError(null);
                      try {
                        await persistNewListing(form.getValues(), false, leaveTarget);
                      } catch (error) {
                        setSaveError((error as Error).message || 'Could not save draft');
                        setSavingDraft(false);
                        setShowLeaveDialog(false);
                      }
                    }}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors disabled:opacity-50"
                  >
                    {savingDraft ? 'Saving…' : 'Save draft'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </ListingImagesProvider>
    </FormProvider>
  );
}
