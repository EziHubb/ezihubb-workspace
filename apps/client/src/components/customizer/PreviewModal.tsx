'use client';

import React from 'react';
import Image from 'next/image';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import { fmtAmount } from '@ezihubb/utils';

interface PreviewModalProps {
  basePrice:   number;
  onAddToCart: () => void;
}

export function PreviewModal({ basePrice, onAddToCart }: PreviewModalProps) {
  const isOpen            = useCustomizerStore((s) => s.isPreviewOpen);
  const isGenerating      = useCustomizerStore((s) => s.isGeneratingPreview);
  const previewImageUrl   = useCustomizerStore((s) => s.previewImageUrl);
  const previewError      = useCustomizerStore((s) => s.previewError);
  const generatePreview   = useCustomizerStore((s) => s.generatePreview);
  const closePreview      = useCustomizerStore((s) => s.closePreview);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={closePreview}
    >
      <div
        className="relative bg-surface rounded-modal shadow-modal w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-secondary">Your Preview</h2>
          <button
            onClick={closePreview}
            aria-label="Close preview"
            className="p-1 rounded-sm text-muted hover:text-secondary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {isGenerating && (
            <div className="flex flex-col items-center gap-4 py-10">
              {/* Animated progress bar */}
              <div className="w-full bg-border rounded-full h-2 overflow-hidden">
                <div className="h-full bg-primary animate-[shimmer_1.5s_infinite_linear] bg-gradient-to-r from-primary via-primary-light to-primary bg-[length:200%_100%]" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-secondary">Generating your preview…</p>
                <p className="text-xs text-muted mt-1">This takes about 20 seconds</p>
              </div>
              <svg className="w-10 h-10 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {!isGenerating && previewError && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-error">{previewError}</p>
              <button
                onClick={() => generatePreview()}
                className="text-sm font-medium text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {!isGenerating && previewImageUrl && (
            <div className="space-y-4">
              <div className="relative aspect-square rounded-md overflow-hidden bg-background">
                <Image
                  src={previewImageUrl}
                  alt="Customized product preview"
                  fill
                  className="object-contain"
                  sizes="(max-width: 640px) 100vw, 512px"
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-sm bg-success/5 border border-success/20">
                <svg className="w-4 h-4 text-success shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-xs text-success font-medium">Looks great! This is an approximate preview — the final product may vary slightly.</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isGenerating && (previewImageUrl || previewError) && (
          <div className="flex gap-3 px-6 py-4 border-t border-border">
            <button
              onClick={closePreview}
              className="flex-1 h-10 rounded-button border border-border text-sm font-medium text-secondary hover:bg-background transition-colors"
            >
              Edit More
            </button>
            <button
              onClick={() => { closePreview(); onAddToCart(); }}
              className="flex-1 h-10 rounded-button bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              Add to Cart — {fmtAmount(basePrice)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
