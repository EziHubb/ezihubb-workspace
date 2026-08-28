'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface CustomizationPreviewModalProps {
  customizationData: Record<string, unknown>;
  previewUrl?:       string;
  productName?:      string;
  onClose:           () => void;
}

export function CustomizationPreviewModal({
  customizationData,
  previewUrl,
  productName,
  onClose,
}: CustomizationPreviewModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // Flatten both the current custom-options payload and legacy customizer data.
  const optionFields = Array.isArray(customizationData.customOptions)
    ? customizationData.customOptions.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const option = entry as Record<string, unknown>;
        const label = typeof option.label === 'string' ? option.label : '';
        if (!label) return [];
        const fields: [string, unknown][] = [];
        const value = option.value;
        if (
          (typeof value === 'string' && value.trim())
          || typeof value === 'number'
          || typeof value === 'boolean'
          || (Array.isArray(value) && value.length > 0)
        ) {
          fields.push([label, value]);
        }
        const file = option.file;
        if (file && typeof file === 'object' && !Array.isArray(file)) {
          const name = (file as Record<string, unknown>).name;
          if (typeof name === 'string') fields.push([`${label} file`, name]);
        }
        return fields;
      })
    : [];
  const legacyFields = Object.entries(customizationData).filter(
    ([k]) => !['previewUrl', 'templateId', 'customOptions'].includes(k),
  );
  const fields = [...optionFields, ...legacyFields];

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Customization preview"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[71] w-[640px] max-w-[95vw] max-h-[85vh] bg-surface rounded-card shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="font-semibold text-secondary">Customization Details</h3>
            {productName && <p className="text-xs text-muted mt-0.5">{productName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-muted/10 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Preview image */}
          {previewUrl && (
            <div className="flex justify-center">
              <div className="relative w-full max-w-sm aspect-square rounded-card overflow-hidden border border-border">
                <Image
                  src={previewUrl}
                  alt="Customization preview"
                  fill
                  className="object-contain"
                  sizes="400px"
                />
              </div>
            </div>
          )}

          {/* Fields */}
          {fields.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
                Customization Fields
              </h4>
              <dl className="space-y-2">
                {fields.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <dt className="font-medium text-muted capitalize">
                      {key.replace(/[_-]/g, ' ')}
                    </dt>
                    <dd className="text-secondary break-words">
                      {typeof value === 'string' || typeof value === 'number'
                        ? String(value)
                        : JSON.stringify(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {fields.length === 0 && !previewUrl && (
            <p className="text-sm text-muted text-center py-8">
              No customization details available.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-background shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-secondary border border-border rounded-button hover:border-primary/40 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
