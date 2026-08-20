'use client';

import { useState, useRef } from 'react';
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
import { type Crop } from 'react-image-crop';
import {
  GripVertical, Trash2, Pencil, X,
  HelpCircle, Film, ImagePlus, Crop as CropIcon,
  Check, VideoOff,
} from 'lucide-react';
import type { ProductEditFormValues, AdminProductDto, ProductImage } from '../types';
import { ThumbnailCropModal } from '../ThumbnailCropModal';
import { api } from '../../../../lib/api-client';
import { API_ROUTES } from '@ezihubb/constants';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 20;
const MAX_VIDEOS = 2;
const VIDEO_MAX_DURATION_SECONDS = 10;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov'];

/**
 * Both MIME types and extensions, on purpose.
 *
 * A MIME-only `accept` relies on the OS knowing the mapping, and Windows in
 * particular often reports nothing for `.mov` — which greys out a file the
 * server would happily take. Listing the extensions as well makes the picker
 * filter on either signal.
 */
const VIDEO_ACCEPT = [...VIDEO_EXTENSIONS, ...VIDEO_MIME_TYPES].join(',');

/**
 * `accept` only filters the file dialog — it is a hint, not a constraint. Every
 * OS picker offers an "All files" escape, so a non-video can still arrive here.
 *
 * Matches on EITHER signal, because browsers disagree about `.mov`: some report
 * `video/quicktime`, some report an empty string. Requiring the MIME type alone
 * would reject a valid clip on those browsers.
 *
 * This is an affordance, not a security control — the server enforces the same
 * list in ProductsService.uploadVideo and is what actually decides.
 */
function isAcceptedVideo(file: File): boolean {
  // A reported type is the stronger signal, so when there is one it decides —
  // including when it disagrees with the extension. Falling through to the
  // extension here would accept a PDF renamed to .mp4.
  if (file.type) return VIDEO_MIME_TYPES.includes(file.type);

  // Empty type means the browser could not work it out, not that the file is
  // bad. Windows commonly reports nothing for .mov, and rejecting on that
  // would block a clip the server accepts. Extension is the only signal left.
  const name = file.name.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => name.endsWith(ext));
}

// ── Video upload helpers ──────────────────────────────────────────────────────

/** Fast, non-authoritative check so a shopper gets instant feedback before
 *  the file even leaves the browser — the server re-checks with ffprobe
 *  since this is trivially spoofable (it's just what the browser's own
 *  decoder reports). */
function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const videoEl = document.createElement('video');
    videoEl.preload = 'metadata';
    videoEl.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(videoEl.duration);
    };
    videoEl.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read this file as a video.'));
    };
    videoEl.src = url;
  });
}

async function uploadVideoFile(
  productId: string,
  file: File,
): Promise<{ url: string; videoUrls: string[] }> {
  const formData = new FormData();
  formData.append('video', file);
  return api.post<{ url: string; videoUrls: string[] }>(
    API_ROUTES.ADMIN.PRODUCT_VIDEOS(productId),
    formData,
  );
}

async function deleteVideoFile(productId: string, url: string): Promise<void> {
  await api.delete(API_ROUTES.ADMIN.PRODUCT_VIDEOS(productId), { data: { url } });
}

// ── Upload helpers (presigned URL flow) ───────────────────────────────────────

async function presignAndUpload(
  files: File[],
): Promise<{ url: string }[]> {
  // Step 1: get presigned URLs from the API
  const presignItems = await api.post<{ presignedUrl: string; publicUrl: string; key: string }[]>(
    API_ROUTES.ADMIN.ASSETS_PRESIGN,
    { files: files.map((f) => ({ name: f.name, mimeType: f.type })) },
  );

  // Step 2: PUT each file directly to R2
  await Promise.all(
    files.map((file, i) =>
      fetch(presignItems[i].presignedUrl, {
        method:  'PUT',
        headers: { 'Content-Type': file.type },
        body:    file,
      }).then((r) => { if (!r.ok) throw new Error(`Upload failed: ${file.name}`); }),
    ),
  );

  return presignItems.map((p) => ({ url: p.publicUrl }));
}

async function attachImageUrls(
  productId: string,
  urls: string[],
): Promise<{ id: string; url: string; isPrimary: boolean; sortOrder: number; altText?: string }[]> {
  return api.post<{ id: string; url: string; isPrimary: boolean; sortOrder: number; altText?: string }[]>(
    API_ROUTES.ADMIN.PRODUCT_IMAGES_FROM_URLS(productId),
    { urls },
  );
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

// ─── Video slot (direct file upload, ≤10s clips) ──────────────────────────────

function VideoSlot({
  productId,
  videoUrls,
  onChange,
}: {
  productId: string;
  videoUrls: string[];
  onChange:  (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = MAX_VIDEOS - videoUrls.length;

  const handleFileSelected = async (file: File) => {
    setError(null);

    // Checked before anything else. Without this, a PDF picked through the
    // dialog's "All files" option fell through to the duration probe and came
    // back as "Could not read this file as a video" — technically true, but it
    // reads like the video is corrupt rather than like the wrong file was
    // chosen, which sends people off re-exporting a clip that was never the
    // problem.
    if (!isAcceptedVideo(file)) {
      setError('Only MP4, WebM, or MOV video files can be uploaded.');
      return;
    }

    if (file.size > VIDEO_MAX_BYTES) {
      setError(`Max ${VIDEO_MAX_BYTES / (1024 * 1024)} MB per video.`);
      return;
    }

    try {
      const duration = await readVideoDuration(file);
      if (duration > VIDEO_MAX_DURATION_SECONDS + 0.5) {
        setError(`Video is ${duration.toFixed(1)}s — max ${VIDEO_MAX_DURATION_SECONDS}s allowed.`);
        return;
      }
    } catch {
      setError('Could not read this file as a video.');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadVideoFile(productId, file);
      onChange(result.videoUrls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (url: string) => {
    onChange(videoUrls.filter((u) => u !== url));
    await deleteVideoFile(productId, url).catch(() => undefined);
  };

  return (
    <div className="aspect-square rounded-xl border-2 border-border bg-background/80 flex flex-col p-2.5 gap-2 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-secondary flex items-center gap-1">
          <Film className="w-3.5 h-3.5 text-primary" /> Videos
        </span>
        <span className="text-[10px] text-muted">{videoUrls.length}/{MAX_VIDEOS}</span>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto">
        {videoUrls.map((url) => (
          <div key={url} className="relative rounded-lg overflow-hidden border border-border bg-black aspect-video group">
            <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
            <button
              type="button"
              onClick={() => handleRemove(url)}
              className="absolute top-1 right-1 p-1 bg-black/60 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full py-2 rounded-lg border-2 border-dashed border-border text-muted hover:border-primary/50 hover:text-primary hover:bg-primary/3 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 text-[11px] font-semibold"
          >
            {uploading ? (
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Film className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Checking & uploading…' : `Add video (${remaining} left)`}
          </button>
        )}
      </div>

      {error && (
        <p className="text-[10px] text-red-600 flex items-start gap-1 shrink-0">
          <VideoOff className="w-3 h-3 shrink-0 mt-0.5" />
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelected(file);
          e.target.value = '';
        }}
      />
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
        className="aspect-square rounded-xl border-2 border-dashed border-border bg-background/80 flex flex-col items-center justify-center gap-2 text-muted hover:border-primary/50 hover:text-primary hover:bg-primary/3 disabled:opacity-40 disabled:cursor-not-allowed transition-all group"
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
  productId:          string;
  imageIds:           string[];
  pendingUrls:        string[];
  videoUrls:          string[];
  imageMap:           Record<string, ProductImage>;
  imageAltTexts:      Record<string, string>;
  onReorder:          (ids: string[]) => void;
  onRemove:           (id: string) => void;
  onEditAlt:          (id: string, current: string) => void;
  onImagesAdded:      (images: { id: string; url: string }[]) => void;
  onPendingUrlsAdded: (urls: string[]) => void;
  onPendingUrlRemoved:(url: string) => void;
  onVideosChange:     (urls: string[]) => void;
}

function DraggablePhotoGrid({
  productId,
  imageIds,
  pendingUrls,
  videoUrls,
  imageMap,
  imageAltTexts,
  onReorder,
  onRemove,
  onEditAlt,
  onImagesAdded,
  onPendingUrlsAdded,
  onPendingUrlRemoved,
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
    const allowed = Math.min(files.length, MAX_PHOTOS - imageIds.length - pendingUrls.length);
    if (allowed <= 0) return;
    const subset = Array.from(files).slice(0, allowed);

    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await presignAndUpload(subset);
      const urls     = uploaded.map((u) => u.url);

      if (productId) {
        // Edit mode: attach immediately → get real image IDs
        const images = await attachImageUrls(productId, urls);
        onImagesAdded(images.map((img) => ({ id: img.id, url: img.url })));
      } else {
        // Create mode: store as pending URLs (attach after product creation)
        onPendingUrlsAdded(urls);
      }
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const remaining = MAX_PHOTOS - imageIds.length - pendingUrls.length;

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={imageIds} strategy={rectSortingStrategy}>
          {/* 5-column grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
            <VideoSlot productId={productId} videoUrls={videoUrls} onChange={onVideosChange} />

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

            {/* Pending images (presign-uploaded, not yet in DB) */}
            {pendingUrls.map((url) => (
              <div key={`pending:${url}`}
                className="group relative rounded-xl overflow-hidden border-2 border-dashed border-primary/40 bg-background aspect-square">
                <Image src={url} alt="Pending upload" fill className="object-cover" sizes="160px" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <button
                  type="button"
                  onClick={() => onPendingUrlRemoved(url)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <span className="absolute bottom-2 left-2 text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-semibold">
                  Saving…
                </span>
              </div>
            ))}

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
  const pendingImageUrls = watch('pendingImageUrls') ?? [];

  const [altEditTarget,  setAltEditTarget]  = useState<{ id: string; current: string } | null>(null);
  const [showCropModal,  setShowCropModal]  = useState(false);

  // Newly attached images not yet in product.images (added during this session)
  const [localImages, setLocalImages] = useState<ProductImage[]>([]);

  // Build lookup map: initial server images + images added this session
  const imageMap = Object.fromEntries(
    [...(product.images ?? []), ...localImages].map((img) => [img.id, img]),
  );

  const primaryImage = imageIds[0] ? imageMap[imageIds[0]] : null;

  const handleReorder = (ids: string[]) => {
    setValue('imageIds', ids, { shouldDirty: true });
    // Persist the new order to the DB immediately (edit mode only — create mode has no real IDs yet)
    if (product.id) {
      // eslint-disable-next-line @typescript-eslint/no-empty-function -- best-effort persist; local reorder above already applied
      api.patch(API_ROUTES.ADMIN.PRODUCT_IMAGES_REORDER(product.id), { orderedIds: ids }).catch(() => {});
    }
  };
  const handleRemove  = (id: string)   => setValue('imageIds', imageIds.filter((i) => i !== id), { shouldDirty: true });
  const handleVideos  = (urls: string[])=> setValue('videoUrls', urls, { shouldDirty: true });
  const handleAltSave = (id: string, text: string) => setValue('imageAltTexts', { ...imageAltTexts, [id]: text }, { shouldDirty: true });
  const handleCropApply = (crop: Crop) => setValue('thumbnailCropData', crop as unknown as Record<string, number>, { shouldDirty: true });

  const handleImagesAdded = (images: { id: string; url: string }[]) => {
    // Keep a local copy so imageMap can resolve the new IDs immediately
    setLocalImages((prev) => [
      ...prev,
      ...images.map((img, i) => ({
        id:        img.id,
        url:       img.url,
        isPrimary: imageIds.length === 0 && i === 0,
        sortOrder: imageIds.length + i,
        altText:   '',
        type:      'MOCKUP' as const,
        printSide: null,
      } satisfies ProductImage)),
    ]);
    setValue('imageIds', [...imageIds, ...images.map((img) => img.id)], { shouldDirty: true });
  };

  const handlePendingUrlsAdded = (urls: string[]) => {
    setValue('pendingImageUrls', [...pendingImageUrls, ...urls], { shouldDirty: true });
  };

  const handlePendingUrlRemoved = (url: string) => {
    setValue('pendingImageUrls', pendingImageUrls.filter((u) => u !== url), { shouldDirty: true });
  };

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-8">
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
        pendingUrls={pendingImageUrls}
        videoUrls={videoUrls}
        imageMap={imageMap}
        imageAltTexts={imageAltTexts}
        onReorder={handleReorder}
        onRemove={handleRemove}
        onEditAlt={(id, cur) => setAltEditTarget({ id, current: cur })}
        onImagesAdded={handleImagesAdded}
        onPendingUrlsAdded={handlePendingUrlsAdded}
        onPendingUrlRemoved={handlePendingUrlRemoved}
        onVideosChange={handleVideos}
      />

      {/* File format hint */}
      <p className="text-xs text-muted -mt-4">
        Photos: JPEG, PNG, WebP · Max 10 MB each · Minimum 800×800 px recommended for best quality
        <br />
        Videos: MP4, WebM, MOV · Max {VIDEO_MAX_DURATION_SECONDS}s · Max {VIDEO_MAX_BYTES / (1024 * 1024)} MB
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

      <ThumbnailCropModal
        isOpen={showCropModal && !!primaryImage}
        primaryImageUrl={primaryImage?.url ?? ''}
        currentCrop={thumbnailCrop}
        onSave={handleCropApply}
        onClose={() => setShowCropModal(false)}
      />
    </div>
  );
}
