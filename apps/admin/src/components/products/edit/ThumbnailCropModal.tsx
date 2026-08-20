'use client';

import { useEffect, useRef, useState } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Crop as CropIcon, Check } from 'lucide-react';

interface Props {
  isOpen:          boolean;
  primaryImageUrl: string;
  currentCrop?:    Crop | null;
  onSave:          (crop: Crop) => void;
  onClose:         () => void;
}

const PREVIEW_SIZES: { label: string; ratio: number; w: number; h: number }[] = [
  { label: 'Square',   ratio: 1,     w: 80, h: 80 },
  { label: 'Portrait', ratio: 3 / 4, w: 60, h: 80 },
  { label: 'Wide',     ratio: 4 / 3, w: 80, h: 60 },
];

const PRESET_CROPS: { label: string; aspect: number; desc: string }[] = [
  { label: 'Square',   aspect: 1,     desc: '1:1 — Search grid'      },
  { label: 'Portrait', aspect: 3 / 4, desc: '3:4 — Category pages'   },
  { label: 'Wide',     aspect: 4 / 3, desc: '4:3 — Recommended'      },
];

export function ThumbnailCropModal({
  isOpen, primaryImageUrl, currentCrop, onSave, onClose,
}: Props) {
  const [crop, setCrop] = useState<Crop>(
    currentCrop ?? { unit: '%', x: 10, y: 10, width: 80, height: 80 },
  );
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (!isOpen) return null;

  const applyPreset = (aspect: number) => {
    const size = aspect >= 1 ? 70 : 80;
    setCrop({
      unit:   '%',
      x:      (100 - size) / 2,
      y:      (100 - size / aspect) / 2,
      width:  size,
      height: size / aspect,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-card border border-border shadow-2xl w-full max-w-[680px] max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h4 className="font-semibold text-secondary flex items-center gap-2">
            <CropIcon className="w-4 h-4 text-primary" />
            Adjust thumbnails
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-muted/10 text-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <p className="text-sm text-muted">
            Thumbnails are cropped versions of your primary listing photo that
            show up across the site.
          </p>

          {/* Preset ratio buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide mr-1">Preset:</span>
            {PRESET_CROPS.map((preset, i) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => { setActivePreset(i); applyPreset(preset.aspect); }}
                className={[
                  'flex-1 py-2 text-xs border rounded-lg transition-colors',
                  activePreset === i
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted hover:border-primary/40',
                ].join(' ')}
              >
                <div className="font-medium">{preset.label}</div>
                <div className="text-muted">{preset.desc}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setActivePreset(null);
                setCrop({ unit: '%', x: 10, y: 10, width: 80, height: 80 });
              }}
              className="px-3 py-2 text-xs border rounded-lg border-border text-muted hover:border-primary/40 transition-colors"
            >
              Free
            </button>
          </div>

          {/* Crop interface + previews */}
          <div className="flex gap-5 items-start">
            <div className="flex-1 min-w-0 bg-background rounded-lg overflow-hidden border border-border">
              <ReactCrop
                crop={crop}
                onChange={(_, pct) => setCrop(pct)}
                aspect={activePreset !== null ? PRESET_CROPS[activePreset].aspect : undefined}
                ruleOfThirds
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
              {PREVIEW_SIZES.map(s => (
                <div key={s.label} className="flex flex-col items-center gap-1">
                  <div
                    className="rounded overflow-hidden border border-border bg-background relative"
                    style={{ width: s.w, height: s.h }}
                  >
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
            onClick={() => { onSave(crop); onClose(); }}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            Save thumbnail
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-muted border border-border rounded-lg hover:border-primary/40 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
