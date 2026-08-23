'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Check, ImageOff, ImagePlus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { ProductImage } from './types';
import type { VariationOption } from './types';
import { useDialog } from '../../../contexts/DialogContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface VariantImagePickerProps {
  /** Variation this option belongs to, for the picker subtitle. */
  variationName?: string;
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
  variationName,
  onSelect,
  onClose,
}: {
  option:         VariationOption;
  productImages:  ProductImage[];
  /** Prefixes the subtitle, so "Circle" reads as "Shape: Circle". */
  variationName?: string;
  onSelect:       (imageId: string | null) => Promise<void>;
  onClose:        () => void;
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
          className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-1">
            <h4 className="text-lg font-bold text-secondary">Link a photo to this option</h4>
            <p className="text-sm text-muted mt-0.5">
              {variationName ? `${variationName}: ` : ''}{option.name || option.value}
            </p>
            <p className="text-sm text-secondary mt-4">
              Choose the photo you want to show buyers when they view this option.
            </p>
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
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
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

            {/* Clearing the link is its own affordance below the grid, not a
                tile inside it — it is not one of the photos. */}
            {productImages.length > 0 && (
              <button
                type="button"
                onClick={() => pick(null)}
                disabled={saving !== null}
                className={[
                  'mt-5 px-6 py-2.5 text-sm font-semibold rounded-full border-2 transition-colors',
                  option.imageId == null
                    ? 'border-secondary text-secondary'
                    : 'border-border text-secondary hover:border-secondary',
                ].join(' ')}
              >
                {saving === '__none__' ? 'Removing…' : 'None'}
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-secondary hover:text-primary transition-colors"
            >
              Cancel
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
  variationName,
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
          variationName={variationName}
          onSelect={handleSelect}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
