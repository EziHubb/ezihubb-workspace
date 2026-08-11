'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Upload, X, Wand2, RotateCcw, ImageIcon } from 'lucide-react';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import type { ImageField } from '../../lib/customizer/types';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
const MAX_MB  = 10;

interface ImageUploadFieldProps {
  field: ImageField;
}

export function ImageUploadField({ field }: ImageUploadFieldProps) {
  const t               = useTranslations('customizer.desktopImageUpload');
  const fieldValue      = useCustomizerStore((s) => s.fieldValues[field.id]);
  const uploadImage     = useCustomizerStore((s) => s.uploadImage);
  const removeBackground = useCustomizerStore((s) => s.removeBackground);
  const revertToOriginal = useCustomizerStore((s) => s.revertToOriginal);

  const inputRef        = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sizeError, setSizeError]  = useState('');

  const isUploading     = fieldValue?.isUploading ?? false;
  const progress        = fieldValue?.uploadProgress ?? 0;
  const imageUrl        = fieldValue?.imageUrl;
  const processedUrl    = fieldValue?.processedImageUrl;
  const bgRemoved       = fieldValue?.bgRemoved ?? false;
  const uploadError     = fieldValue?.error;
  const displayUrl      = processedUrl ?? imageUrl;

  const handleFile = async (file: File) => {
    setSizeError('');

    // Client-side validation
    if (!file.type.match(/^image\/(jpeg|png|webp|heic|heif)$/)) {
      setSizeError(t('unsupportedType'));
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setSizeError(t('sizeError', { max: MAX_MB }));
      return;
    }

    await uploadImage(field.id, file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-secondary">
          {field.label}
          {field.required && <span className="text-error ml-0.5">*</span>}
        </label>
        {displayUrl && !isUploading && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-primary hover:underline"
          >
            {t('replace')}
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleInputChange}
        className="sr-only"
        aria-label={t('uploadLabel', { label: field.label })}
      />

      {/* ── Upload zone (shown when no image) ──────────────────────────────── */}
      {!displayUrl && !isUploading && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          aria-label={t('uploadImage')}
          className={[
            'flex flex-col items-center justify-center gap-2 w-full py-8 px-4',
            'border-2 border-dashed rounded-sm cursor-pointer transition-colors text-center',
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-primary/3',
          ].join(' ')}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-secondary">
              {t.rich('dropOrBrowse', {
                browse: (chunks) => <span className="text-primary underline">{chunks}</span>,
              })}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {t('sizeHint', { max: MAX_MB })}
            </p>
          </div>
        </div>
      )}

      {/* ── Upload progress ─────────────────────────────────────────────────── */}
      {isUploading && (
        <div className="space-y-2">
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` } as React.CSSProperties}
            />
          </div>
          <p className="text-xs text-muted text-center">
            {progress < 100
              ? t('uploading', { progress })
              : bgRemoved === false && fieldValue?.processedImageUrl === undefined
              ? t('removingBg')
              : t('processing')}
          </p>
        </div>
      )}

      {/* ── Uploaded image preview ──────────────────────────────────────────── */}
      {displayUrl && !isUploading && (
        <div className="relative">
          <div className="relative w-full aspect-square max-w-[240px] rounded-sm overflow-hidden bg-background border border-border">
            <Image
              src={displayUrl}
              alt={t('uploadedAlt')}
              fill
              sizes="240px"
              className="object-cover"
            />
            {bgRemoved && (
              <div className="absolute top-1.5 left-1.5 text-[10px] font-semibold bg-success text-white px-1.5 py-0.5 rounded-pill">
                {t('bgRemoved')}
              </div>
            )}

            {/* Remove image button */}
            <button
              type="button"
              onClick={() => revertToOriginal(field.id)}
              aria-label={t('removeImage')}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action bar */}
          {field.allowBgRemoval && imageUrl && (
            <div className="flex flex-wrap gap-2 mt-2">
              {!bgRemoved ? (
                <button
                  type="button"
                  onClick={() => removeBackground(field.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary hover:text-primary transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  {t('removeBackground')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => revertToOriginal(field.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-secondary border border-border rounded-button px-3 py-1.5 hover:border-primary hover:text-primary transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t('revertToOriginal')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Optional image hint ─────────────────────────────────────────────── */}
      {!field.required && !imageUrl && !isUploading && (
        <p className="text-xs text-muted flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          {t('bestResultsHint')}
        </p>
      )}

      {/* ── Error messages ──────────────────────────────────────────────────── */}
      {(sizeError || uploadError) && (
        <p className="text-xs text-error" role="alert">
          {sizeError || uploadError}
        </p>
      )}

      {field.helpText && !sizeError && !uploadError && (
        <p className="text-xs text-muted">{field.helpText}</p>
      )}
    </div>
  );
}
