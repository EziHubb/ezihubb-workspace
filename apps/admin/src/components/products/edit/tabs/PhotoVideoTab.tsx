'use client';

import { useState, useRef, useCallback, useId } from 'react';
import { useFormContext } from 'react-hook-form';
import Image from 'next/image';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  GripVertical, Trash2, Pencil, X,
  HelpCircle, Film, ImagePlus, Crop as CropIcon,
  Check,
} from 'lucide-react';
import { getSession } from 'next-auth/react';
import type { ProductEditFormValues, AdminProductDto, ProductImage } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 20;
const MAX_VIDEOS = 2;
const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002/api/v1';

// ── Upload helper (multipart/form-data — can't use clientFetch) ───────────────

async function uploadImages(
  productId: string,
  files: FileList,
): Promise<string[]> {
  const session    = await getSession();
  const token      = (session?.user as Record<string, unknown>)?.['accessToken'] as string | undefined;
  const formData   = new FormData();
  Array.from(files).forEach((f) => formData.append('images', f));

  const res  = await fetch(`${BASE}/admin/products/${productId}/images`, {
    method:  'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body:    formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  const body = await res.json();
  return ((body.data ?? body) as ProductImage[]).map((img) => img.id);
}

// ─── Modals ───────────────────────────────────────────────────────────────────

// ── Alt-text edit modal ───────────────────────────────────────────────────────

function AltTextModal({
  imageId, current, onSave, onClose,
}: {
  imageId: string;
  current: string;
  onSave:  (id: string, text: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[420px] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-secondary">Edit image alt text</h4>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>
          <p className="text-xs text-muted mb-2">
            Alt text describes images for screen readers and improves SEO.
          </p>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={255}
            rows={3}
            autoFocus
            className="w-full px-3 py-2 text-sm border border-border rounded-button bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none placeholder:text-muted"
            placeholder="e.g. Hand-painted ceramic mug in navy blue with gold leaf detail"
          />
          <p className="text-xs text-muted/60 mt-1 text-right">{value.length}/255</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { onSave(imageId, value); onClose(); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-button transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Save
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Thumbnail crop modal ──────────────────────────────────────────────────────

const PREVIEW_SIZES: { label: string; ratio: number; w: number; h: number }[] = [
  { label: 'Square',   ratio: 1,      w: 80, h: 80  },
  { label: 'Portrait', ratio: 3 / 4,  w: 60, h: 80  },
  { label: 'Wide',     ratio: 4 / 3,  w: 80, h: 60  },
];

function ThumbnailCropModal({
  primaryImageUrl,
  initialCrop,
  onApply,
  onClose,
}: {
  primaryImageUrl: string;
  initialCrop:     Crop | null;
  onApply:         (crop: Crop) => void;
  onClose:         () => void;
}) {
  const [crop, setCrop] = useState<Crop>(
    initialCrop ?? { unit: '%', x: 10, y: 10, width: 80, height: 80 },
  );
  const [activeRatio, setActiveRatio] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const applyRatio = (ratio: number) => {
    setActiveRatio(ratio);
    // Centre a crop of the given aspect ratio
    const size = ratio >= 1 ? 70 : 80;
    setCrop({
      unit:   '%',
      x:      (100 - size) / 2,
      y:      (100 - size / ratio) / 2,
      width:  size,
      height: size / ratio,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[680px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h4 className="font-semibold text-secondary flex items-center gap-2">
            <CropIcon className="w-4 h-4 text-primary" />
            Adjust thumbnails
          </h4>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted/10 text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <p className="text-sm text-muted">
            Drag to select the crop area. Thumbnails appear across search results and shop pages.
          </p>

          {/* Ratio presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide mr-1">Preset:</span>
            {PREVIEW_SIZES.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => applyRatio(s.ratio)}
                className={[
                  'px-3 py-1.5 text-xs font-semibold rounded-button border transition-colors',
                  activeRatio === s.ratio
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted hover:border-primary/40',
                ].join(' ')}
              >
                {s.label} ({s.label === 'Square' ? '1:1' : s.label === 'Portrait' ? '3:4' : '4:3'})
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setActiveRatio(null); setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 }); }}
              className="px-3 py-1.5 text-xs font-semibold rounded-button border border-border text-muted hover:border-primary/40 transition-colors"
            >
              Free
            </button>
          </div>

          {/* Crop interface */}
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 bg-background rounded-button overflow-hidden border border-border">
              <ReactCrop
                crop={crop}
                onChange={(_, pct) => setCrop(pct)}
                aspect={activeRatio ?? undefined}
                className="max-h-[320px] w-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={primaryImageUrl}
                  alt="Crop preview"
                  className="max-h-[320px] w-full object-contain"
                />
              </ReactCrop>
            </div>

            {/* Preview panels */}
            <div className="shrink-0 space-y-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">Preview</p>
              {PREVIEW_SIZES.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1">
                  <div
                    className="rounded overflow-hidden border border-border bg-background relative"
                    style={{ width: s.w, height: s.h }}
                  >
                    {/* CSS crop simulation */}
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:    `url(${primaryImageUrl})`,
                        backgroundSize:     `${100 / (crop.width / 100)}%`,
                        backgroundPosition: `${crop.x === 0 ? 0 : -(crop.x / crop.width) * 100}% ${crop.y === 0 ? 0 : -(crop.y / crop.height) * 100}%`,
                        backgroundRepeat:   'no-repeat',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={() => { onApply(crop); onClose(); }}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-button transition-colors"
          >
            <Check className="w-4 h-4" />
            Apply
          </button>
          <button type="button" onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable image slot ──────────────────────────────────────────────────────

interface SortableImageSlotProps {
  id:         string;
  imageUrl:   string;
  altText:    string;
  isFeatured: boolean;
  onRemove:   () => void;
  onEditAlt:  (current: string) => void;
}

function SortableImageSlot({
  id, imageUrl, altText, isFeatured, onRemove, onEditAlt,
}: SortableImageSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0.4 : 1,
    zIndex:     isDragging ? 10 : undefined,
    position:   isDragging ? 'relative' : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group relative rounded-xl overflow-hidden border-2 bg-background aspect-square select-none',
        isDragging ? 'border-primary shadow-lg' : 'border-border',
      ].join(' ')}
    >
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={altText || 'Product image'}
          fill
          className="object-cover pointer-events-none"
          sizes="160px"
          draggable={false}
        />
      )}

      {/* Featured badge */}
      {isFeatured && (
        <span className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md shadow-sm z-10">
          Featured
        </span>
      )}

      {/* Hover controls */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          type="button"
          onClick={() => onEditAlt(altText)}
          className="p-1.5 bg-black/60 rounded-lg text-white hover:bg-black/80 backdrop-blur-sm"
          title="Edit alt text"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 bg-black/60 rounded-lg text-white hover:bg-red-600/80 backdrop-blur-sm"
          title="Remove"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
      >
        <div className="p-1 bg-black/50 rounded-lg backdrop-blur-sm">
          <GripVertical className="w-3.5 h-3.5 text-white" />
        </div>
      </div>
    </div>
  );
}

// ─── Static video slot ────────────────────────────────────────────────────────

function VideoSlot({
  videoUrls,
  onChange,
}: {
  videoUrls: string[];
  onChange:  (urls: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(videoUrls.length > 0);
  const remaining = MAX_VIDEOS - videoUrls.length;

  const handleAdd = () => {
    if (videoUrls.length < MAX_VIDEOS) {
      onChange([...videoUrls, '']);
      setExpanded(true);
    }
  };

  const handleRemove = (idx: number) => {
    onChange(videoUrls.filter((_, i) => i !== idx));
  };

  const handleChange = (idx: number, val: string) => {
    const u = [...videoUrls];
    u[idx] = val;
    onChange(u);
  };

  if (!expanded || videoUrls.length === 0) {
    return (
      <button
        type="button"
        onClick={handleAdd}
        className="aspect-square rounded-xl border-2 border-dashed border-border bg-background/80 flex flex-col items-center justify-center gap-2 text-muted hover:border-primary/50 hover:text-primary hover:bg-primary/3 transition-all group"
      >
        <div className="w-8 h-8 rounded-full bg-muted/10 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
          <Film className="w-4 h-4" />
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold">Add videos</p>
          <p className="text-[11px] text-muted/60">{remaining} remaining</p>
        </div>
      </button>
    );
  }

  return (
    <div className="aspect-square rounded-xl border-2 border-border bg-background/80 flex flex-col p-3 gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-secondary flex items-center gap-1">
          <Film className="w-3.5 h-3.5 text-primary" /> Videos
        </span>
        {remaining > 0 && (
          <button type="button" onClick={handleAdd} className="text-[10px] text-primary hover:underline">
            + Add
          </button>
        )}
      </div>
      <div className="flex-1 space-y-1.5 overflow-hidden">
        {videoUrls.map((url, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <input
              value={url}
              onChange={(e) => handleChange(idx, e.target.value)}
              placeholder="YouTube or Vimeo URL"
              className="flex-1 min-w-0 px-2 py-1 text-[11px] border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/20 font-mono placeholder:font-sans placeholder:text-muted"
            />
            <button type="button" onClick={() => handleRemove(idx)} className="text-muted hover:text-red-500 shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Add photos slot ──────────────────────────────────────────────────────────

function AddPhotosSlot({
  remaining,
  uploading,
  onFilesSelected,
}: {
  remaining:       number;
  uploading:       boolean;
  onFilesSelected: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (remaining <= 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="aspect-square rounded-xl border-2 border-dashed border-border bg-background/80 flex flex-col items-center justify-center gap-2 text-muted hover:border-primary/50 hover:text-primary hover:bg-primary/3 disabled:opacity-50 transition-all group"
      >
        {uploading ? (
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted/10 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
            <ImagePlus className="w-4 h-4" />
          </div>
        )}
        <div className="text-center">
          <p className="text-xs font-semibold">{uploading ? 'Uploading…' : 'Add photos'}</p>
          {!uploading && <p className="text-[11px] text-muted/60">{remaining} remaining</p>}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

// ─── Draggable photo grid ─────────────────────────────────────────────────────

interface DraggablePhotoGridProps {
  productId:         string;
  imageIds:          string[];
  videoUrls:         string[];
  imageMap:          Record<string, ProductImage>;
  imageAltTexts:     Record<string, string>;
  onReorder:         (ids: string[]) => void;
  onRemove:          (id: string) => void;
  onEditAlt:         (id: string, current: string) => void;
  onImagesAdded:     (ids: string[]) => void;
  onVideosChange:    (urls: string[]) => void;
}

function DraggablePhotoGrid({
  productId,
  imageIds,
  videoUrls,
  imageMap,
  imageAltTexts,
  onReorder,
  onRemove,
  onEditAlt,
  onImagesAdded,
  onVideosChange,
}: DraggablePhotoGridProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = imageIds.indexOf(active.id as string);
      const newIdx = imageIds.indexOf(over.id as string);
      if (oldIdx !== -1 && newIdx !== -1) {
        onReorder(arrayMove(imageIds, oldIdx, newIdx));
      }
    }
  };

  const handleFilesSelected = async (files: FileList) => {
    const allowed = Math.min(files.length, MAX_PHOTOS - imageIds.length);
    if (allowed <= 0) return;
    const subset = Array.from(files).slice(0, allowed);
    const dt     = new DataTransfer();
    subset.forEach((f) => dt.items.add(f));
    setUploading(true);
    setUploadError(null);
    try {
      const newIds = await uploadImages(productId, dt.files);
      onImagesAdded(newIds);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const remaining = MAX_PHOTOS - imageIds.length;

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={imageIds} strategy={rectSortingStrategy}>
          {/* 5-column grid */}
          <div className="grid grid-cols-5 gap-3">
            {/* Slot 0: Featured image */}
            {imageIds.length > 0 && imageMap[imageIds[0]] && (
              <SortableImageSlot
                id={imageIds[0]}
                imageUrl={imageMap[imageIds[0]]?.url ?? ''}
                altText={imageAltTexts[imageIds[0]] ?? imageMap[imageIds[0]]?.altText ?? ''}
                isFeatured
                onRemove={() => onRemove(imageIds[0])}
                onEditAlt={(cur) => onEditAlt(imageIds[0], cur)}
              />
            )}

            {/* Fixed slot 1: Video */}
            <VideoSlot videoUrls={videoUrls} onChange={onVideosChange} />

            {/* Slots 2..n: remaining photos */}
            {imageIds.slice(1).map((id) => {
              const img = imageMap[id];
              if (!img) return null;
              return (
                <SortableImageSlot
                  key={id}
                  id={id}
                  imageUrl={img.url}
                  altText={imageAltTexts[id] ?? img.altText ?? ''}
                  isFeatured={false}
                  onRemove={() => onRemove(id)}
                  onEditAlt={(cur) => onEditAlt(id, cur)}
                />
              );
            })}

            {/* Last slot: Add photos */}
            <AddPhotosSlot
              remaining={remaining}
              uploading={uploading}
              onFilesSelected={handleFilesSelected}
            />
          </div>
        </SortableContext>
      </DndContext>

      {uploadError && (
        <p className="text-sm text-red-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          {uploadError}
        </p>
      )}
    </div>
  );
}

// ─── Thumbnail preview ────────────────────────────────────────────────────────

function ThumbnailPreview({
  primaryImageUrl,
  cropData,
}: {
  primaryImageUrl: string | undefined;
  cropData:        Crop | null;
}) {
  if (!primaryImageUrl) {
    return (
      <div className="flex gap-4">
        {PREVIEW_SIZES.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border-2 border-dashed border-border bg-background flex items-center justify-center text-muted text-xs"
            style={{ width: s.w * 1.2, height: s.h * 1.2 }}
          >
            {s.label}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-4">
      {PREVIEW_SIZES.map((s) => {
        const widthPct  = cropData?.width  ?? 80;
        const heightPct = cropData?.height ?? 80;
        const xPct      = cropData?.x      ?? 10;
        const yPct      = cropData?.y      ?? 10;

        return (
          <div key={s.label} className="flex flex-col items-center gap-1.5">
            <div
              className="rounded-lg overflow-hidden border border-border shadow-sm"
              style={{ width: s.w * 1.2, height: s.h * 1.2, position: 'relative' }}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:    `url(${primaryImageUrl})`,
                  backgroundSize:     `${(100 / widthPct) * 100}%`,
                  backgroundPosition: `${(xPct / (100 - widthPct)) * 100}% ${(yPct / (100 - heightPct)) * 100}%`,
                  backgroundRepeat:   'no-repeat',
                }}
              />
            </div>
            <span className="text-[11px] text-muted">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Info tooltip ─────────────────────────────────────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex ml-1.5 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-muted hover:text-secondary transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 px-3 py-2 bg-secondary text-white text-xs rounded-lg shadow-lg z-10 whitespace-normal leading-snug">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-secondary" />
        </span>
      )}
    </span>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

interface PhotoVideoTabProps { product: AdminProductDto }

export function PhotoVideoTab({ product }: PhotoVideoTabProps) {
  const { watch, setValue } = useFormContext<ProductEditFormValues>();

  const imageIds        = watch('imageIds')          ?? [];
  const videoUrls       = watch('videoUrls')         ?? [];
  const thumbnailCrop   = watch('thumbnailCropData') as Crop | null;
  const imageAltTexts   = watch('imageAltTexts')     ?? {};

  const [altEditTarget,  setAltEditTarget]  = useState<{ id: string; current: string } | null>(null);
  const [showCropModal,  setShowCropModal]  = useState(false);

  // Build lookup map from product images
  const imageMap = Object.fromEntries(
    (product.images ?? []).map((img) => [img.id, img]),
  );

  const primaryImage = imageIds[0] ? imageMap[imageIds[0]] : null;

  const handleReorder    = (ids: string[]) => setValue('imageIds',          ids,  { shouldDirty: true });
  const handleRemove     = (id: string)    => setValue('imageIds',          imageIds.filter((i) => i !== id), { shouldDirty: true });
  const handleImagesAdded= (ids: string[]) => setValue('imageIds',          [...imageIds, ...ids], { shouldDirty: true });
  const handleVideos     = (urls: string[])=> setValue('videoUrls',         urls, { shouldDirty: true });
  const handleAltSave    = (id: string, text: string) => setValue('imageAltTexts', { ...imageAltTexts, [id]: text }, { shouldDirty: true });
  const handleCropApply  = (crop: Crop)    => setValue('thumbnailCropData', crop as unknown as Record<string, number>, { shouldDirty: true });

  return (
    <div className="max-w-[920px] mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-secondary">Photo and video</h2>
        <p className="text-sm text-muted mt-1">
          Show off different angles, available options, or even a peek behind the scenes at your process.
        </p>
      </div>

      {/* Instruction row */}
      <div className="flex items-center gap-1 text-sm text-secondary">
        Add up to <span className="font-semibold mx-0.5">{MAX_PHOTOS} photos</span>
        and <span className="font-semibold mx-0.5">{MAX_VIDEOS} videos.</span>
        <span className="text-red-500 ml-0.5">*</span>
        <InfoTooltip text="Use all 20 slots to showcase every variation, angle, and personalisation detail. More photos = higher conversion." />
      </div>

      {/* Draggable photo grid */}
      <DraggablePhotoGrid
        productId={product.id}
        imageIds={imageIds}
        videoUrls={videoUrls}
        imageMap={imageMap}
        imageAltTexts={imageAltTexts}
        onReorder={handleReorder}
        onRemove={handleRemove}
        onEditAlt={(id, cur) => setAltEditTarget({ id, current: cur })}
        onImagesAdded={handleImagesAdded}
        onVideosChange={handleVideos}
      />

      {/* File format hint */}
      <p className="text-xs text-muted -mt-4">
        Supported: JPEG, PNG, WebP · Max 20 MB per image · Minimum 800×800 px recommended for best quality
      </p>

      {/* ── Thumbnails section ────────────────────────────────────────────── */}
      <div className="border-t border-border pt-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-secondary">Thumbnails</h3>
            <p className="text-sm text-muted mt-1 max-w-lg leading-relaxed">
              Thumbnails are cropped versions of your primary listing photo that show up
              across the site. Make adjustments to preview the most common thumbnail
              sizes that shoppers will see.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCropModal(true)}
            disabled={!primaryImage}
            className="flex items-center gap-1.5 text-sm font-medium text-secondary border border-border rounded-button px-3 py-2 hover:border-primary/40 hover:text-primary disabled:opacity-40 transition-colors shrink-0"
          >
            <CropIcon className="w-3.5 h-3.5" />
            Adjust thumbnails
          </button>
        </div>

        <ThumbnailPreview
          primaryImageUrl={primaryImage?.url}
          cropData={thumbnailCrop}
        />
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {altEditTarget && (
        <AltTextModal
          imageId={altEditTarget.id}
          current={altEditTarget.current}
          onSave={handleAltSave}
          onClose={() => setAltEditTarget(null)}
        />
      )}

      {showCropModal && primaryImage && (
        <ThumbnailCropModal
          primaryImageUrl={primaryImage.url}
          initialCrop={thumbnailCrop}
          onApply={handleCropApply}
          onClose={() => setShowCropModal(false)}
        />
      )}
    </div>
  );
}
