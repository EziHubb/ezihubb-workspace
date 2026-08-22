'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Check, ImageOff, X, ImagePlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { ProductImage } from './types';
import type { VariationOption } from './types';
import { useDialog } from '../../../contexts/DialogContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface VariantImagePickerProps {
  option:        VariationOption;
  productId:     string;
  productImages: ProductImage[];
}

// ─── Modal ────────────────────────────────────────────────────────────────────
// Exported because two callers need the same picker on different commit rules:
// the summary table saves the moment you choose, while the Manage Variations
// modal has to hold the choice in its draft until Apply. This component knows
// nothing about either — it just reports the chosen image through onSelect.

export function VariantImagePickerModal({
  option,
  productImages,
  onSelect,
  onClose,
}: {
  option:        VariationOption;
  productImages: ProductImage[];
  onSelect:      (imageId: string | null) => Promise<void>;
  onClose:       () => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const pick = async (imageId: string | null) => {
    setSaving(imageId ?? '__none__');
    try {
      await onSelect(imageId);
    } finally {
      setSaving(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h4 className="font-semibold text-secondary">
                Photo for <span className="text-primary">"{option.name || option.value}"</span>
              </h4>
              <p className="text-xs text-muted mt-0.5">
                Select which product photo represents this variant.
                This photo will show when buyers choose "{option.name || option.value}".
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-button hover:bg-muted/10 text-muted transition-colors shrink-0 ml-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Grid */}
          <div className="px-5 py-5">
            {productImages.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <ImageOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No product photos yet.</p>
                <p className="text-xs mt-1">Upload photos in the Photo & Video tab first.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* "None" option */}
                <button
                  type="button"
                  onClick={() => pick(null)}
                  disabled={saving !== null}
                  className={[
                    'aspect-square rounded-lg border-2 flex flex-col items-center justify-center gap-1.5 text-xs font-medium transition-all',
                    option.imageId == null
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-dashed border-border text-muted hover:border-primary/50 hover:text-secondary',
                  ].join(' ')}
                >
                  {saving === '__none__'
                    ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : <ImageOff className="w-5 h-5 opacity-60" />
                  }
                  None
                </button>

                {/* Product images */}
                {productImages.map((img) => {
                  const isSelected = option.imageId === img.id;
                  const isSaving   = saving === img.id;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => pick(img.id)}
                      disabled={saving !== null}
                      className={[
                        'aspect-square rounded-lg overflow-hidden border-2 relative transition-all',
                        isSelected
                          ? 'border-primary ring-2 ring-primary/25'
                          : 'border-transparent hover:border-primary/50',
                      ].join(' ')}
                      title={img.altText ?? ''}
                    >
                      <Image
                        src={img.url}
                        alt={img.altText ?? 'Product photo'}
                        fill
                        className="object-cover"
                        sizes="96px"
                        draggable={false}
                      />

                      {/* Saving spinner */}
                      {isSaving && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}

                      {/* Selected checkmark */}
                      {isSelected && !isSaving && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
                          <Check className="w-3 h-3 text-white" strokeWidth={2.5} />
                        </div>
                      )}

                      {/* Primary badge */}
                      {img.isPrimary && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] font-semibold text-center py-0.5">
                          Main
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-button hover:border-primary/40 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Trigger button + modal ───────────────────────────────────────────────────

export function VariantImagePicker({
  option,
  productId,
  productImages,
}: VariantImagePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const qc = useQueryClient();
  const { alert } = useDialog();

  const assignedImage = productImages.find((img) => img.id === option.imageId);

  const handleSelect = async (imageId: string | null) => {
    try {
      await api.patch(
        `/admin/products/${productId}/variations/${option.groupId}/options/${option.id}`,
        { imageId },
      );
      qc.invalidateQueries({ queryKey: ['variation-groups', productId] });
      setIsOpen(false);
    } catch (err) {
      await alert((err as Error).message || 'Could not assign this image.', { variant: 'error' });
    }
  };

  return (
    <>
      {/* Trigger — thumbnail or placeholder */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group relative w-10 h-10 rounded-lg overflow-hidden border-2 border-dashed border-border hover:border-primary/60 flex items-center justify-center bg-background transition-all"
        title="Click to assign a product photo to this variant"
      >
        {assignedImage ? (
          <>
            <Image
              src={assignedImage.url}
              alt={option.name || option.value}
              fill
              className="object-cover"
              sizes="40px"
              draggable={false}
            />
            {/* Edit overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-[10px] font-semibold">Edit</span>
            </div>
          </>
        ) : (
          <ImagePlus className="w-4 h-4 text-muted/40 group-hover:text-primary/60 transition-colors" />
        )}
      </button>

      {/* Picker modal */}
      {isOpen && (
        <VariantImagePickerModal
          option={option}
          productImages={productImages}
          onSelect={handleSelect}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
