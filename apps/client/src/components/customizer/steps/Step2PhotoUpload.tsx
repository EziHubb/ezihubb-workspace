'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Cloud, Check, RefreshCw, Wand2 } from 'lucide-react';
import { useCustomizerStore } from '../../../lib/store/customizer.store';
import type { ImageField } from '../../../lib/customizer/types';

const ACCEPT  = 'image/*';
const MAX_MB  = 10;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface FieldUploadProps {
  field: ImageField;
}

function ImageFieldUpload({ field }: FieldUploadProps) {
  const fieldValue       = useCustomizerStore((s) => s.fieldValues[field.id]);
  const uploadImage      = useCustomizerStore((s) => s.uploadImage);
  const removeBackground = useCustomizerStore((s) => s.removeBackground);
  const revertToOriginal = useCustomizerStore((s) => s.revertToOriginal);

  const inputRef        = useRef<HTMLInputElement>(null);
  const [sizeError, setSizeError] = useState('');
  const [fileSize,  setFileSize]  = useState(0);
  const [fileName,  setFileName]  = useState('');

  const isUploading  = fieldValue?.isUploading ?? false;
  const progress     = fieldValue?.uploadProgress ?? 0;
  const imageUrl     = fieldValue?.imageUrl;
  const processedUrl = fieldValue?.processedImageUrl;
  const bgRemoved    = fieldValue?.bgRemoved ?? false;
  const displayUrl   = processedUrl ?? imageUrl;
  const uploadError  = fieldValue?.error;

  const isRemovingBg = isUploading && imageUrl && !processedUrl;

  const handleFile = async (file: File) => {
    setSizeError('');
    if (file.size > MAX_MB * 1024 * 1024) {
      setSizeError(`Photo must be under ${MAX_MB}MB.`);
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    await uploadImage(field.id, file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Label */}
      <p className="text-sm font-medium text-secondary">
        {field.label}
        {field.required && <span className="text-error ml-0.5">*</span>}
      </p>

      {/* Hidden native file input with camera capture */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        capture="environment"
        onChange={handleInputChange}
        className="sr-only"
        aria-label={`Upload ${field.label}`}
      />

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!displayUrl && !isUploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-[120px] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl bg-background hover:border-primary/50 transition-colors"
        >
          <Cloud className="w-10 h-10 text-primary" />
          <span className="text-sm font-bold text-secondary">Tap to upload</span>
          <span className="text-xs text-muted">or take a photo</span>
          <span className="text-[11px] text-muted/70 mt-0.5">
            JPG · PNG · HEIC up to 10MB
          </span>
        </button>
      )}

      {/* ── Uploading progress ───────────────────────────────────────────────── */}
      {isUploading && !isRemovingBg && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-background border border-border shrink-0">
              {imageUrl && (
                <Image src={imageUrl} alt="uploading" fill sizes="56px" className="object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary truncate">{fileName}</p>
              <p className="text-xs text-muted">Uploading... {progress}%</p>
            </div>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Remove background processing ────────────────────────────────────── */}
      {isRemovingBg && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-background border border-border shrink-0">
              <div className="absolute inset-0 bg-gradient-to-r from-border/40 via-background to-border/40 animate-shimmer bg-[length:400%_100%]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary">✨ Removing background...</p>
              <p className="text-xs text-muted">Usually 5–10 seconds</p>
            </div>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[shimmer_1.5s_infinite_linear] bg-gradient-to-r from-primary via-primary-light to-primary bg-[length:200%_100%]" />
          </div>
          <button
            type="button"
            onClick={() => revertToOriginal(field.id)}
            className="text-xs text-muted hover:text-secondary underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Uploaded + ready ─────────────────────────────────────────────────── */}
      {displayUrl && !isUploading && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-background border border-border shrink-0">
              <Image src={displayUrl} alt="Uploaded photo" fill sizes="64px" className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary truncate">{fileName || 'Photo'}</p>
              {fileSize > 0 && (
                <p className="text-xs text-muted">{formatBytes(fileSize)}</p>
              )}
              <div className="flex items-center gap-1 mt-0.5">
                {bgRemoved ? (
                  <>
                    <Check className="w-3 h-3 text-success" />
                    <span className="text-xs text-success font-medium">
                      Background removed ✓
                    </span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 text-success" />
                    <span className="text-xs text-success font-medium">Ready</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {field.allowBgRemoval && imageUrl && !bgRemoved && (
              <button
                type="button"
                onClick={() => removeBackground(field.id)}
                className="flex items-center justify-center gap-2 w-full h-10 border border-border rounded-button text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors"
              >
                <Wand2 className="w-4 h-4" />
                Remove Background
              </button>
            )}

            {bgRemoved && (
              <button
                type="button"
                onClick={() => revertToOriginal(field.id)}
                className="flex items-center justify-center gap-2 w-full h-10 border border-border rounded-button text-sm font-medium text-muted hover:text-secondary transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Undo
              </button>
            )}

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex items-center justify-center gap-2 w-full h-10 border border-border rounded-button text-sm font-medium text-secondary hover:border-primary hover:text-primary transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Replace
            </button>
          </div>
        </div>
      )}

      {/* Errors */}
      {(sizeError || uploadError) && (
        <p className="text-xs text-error" role="alert">
          {sizeError || uploadError}
        </p>
      )}

      {/* Skip option */}
      {!field.required && !displayUrl && !isUploading && (
        <p className="text-xs text-muted text-center">
          No photo?{' '}
          <button
            type="button"
            onClick={() => {/* parent handles step navigation */}}
            className="text-primary font-medium hover:underline"
          >
            Skip this step →
          </button>
        </p>
      )}
    </div>
  );
}

// ── Step wrapper ─────────────────────────────────────────────────────────────

export function Step2PhotoUpload() {
  const template = useCustomizerStore((s) => s.template);

  if (!template) return null;

  const imageFields = template.fields.filter(
    (f): f is ImageField => f.type === 'image',
  );

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-base font-bold text-secondary">Upload a Photo</h4>
        <p className="text-sm text-muted mt-1">
          Add a personal photo to make this gift truly one-of-a-kind.
        </p>
      </div>

      {imageFields.map((field) => (
        <ImageFieldUpload key={field.id} field={field} />
      ))}

      {imageFields.length === 0 && (
        <p className="text-sm text-muted text-center py-4">
          No photo upload required for this product.
        </p>
      )}
    </div>
  );
}
