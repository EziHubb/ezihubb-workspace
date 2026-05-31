'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@mlh/ui';
import type { Crop, PixelCrop } from 'react-image-crop';
// CSS must be imported alongside the component (safe in 'use client' — Next.js bundles it)
import 'react-image-crop/dist/ReactCrop.css';

// ── Dynamic import — react-image-crop only runs in browser ────────────────────

const ReactCrop = dynamic(
  () => import('react-image-crop').then((mod) => ({ default: mod.default ?? mod.ReactCrop })),
  { ssr: false },
);

// ── Crop-from-canvas helper ───────────────────────────────────────────────────

function cropImageToBlob(
  img:   HTMLImageElement,
  crop:  PixelCrop,
  onDone: (blob: Blob) => void,
): void {
  const canvas  = document.createElement('canvas');
  const ctx     = canvas.getContext('2d');
  if (!ctx) return;

  const scaleX = img.naturalWidth  / img.width;
  const scaleY = img.naturalHeight / img.height;

  canvas.width  = Math.floor(crop.width  * scaleX);
  canvas.height = Math.floor(crop.height * scaleY);

  ctx.drawImage(
    img,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width  * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  canvas.toBlob((blob) => { if (blob) onDone(blob); }, 'image/jpeg', 0.9);
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ImageCropModalProps {
  isOpen:       boolean;
  imageUrl:     string;
  aspectRatio?: number;
  onCrop:       (croppedBlob: Blob) => void;
  onClose:      () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ImageCropModal({
  isOpen,
  imageUrl,
  aspectRatio,
  onCrop,
  onClose,
}: ImageCropModalProps) {
  const imgRef         = useRef<HTMLImageElement>(null);
  const [crop,         setCrop]         = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [rotation,     setRotation]     = useState(0);
  const [scale,        setScale]        = useState(1);
  const [applying,     setApplying]     = useState(false);

  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      // Auto-center crop at mount
      import('react-image-crop').then(({ makeAspectCrop, centerCrop }) => {
        const initialCrop = aspectRatio
          ? centerCrop(
              makeAspectCrop({ unit: '%', width: 80 }, aspectRatio, width, height),
              width,
              height,
            )
          : { unit: '%' as const, x: 10, y: 10, width: 80, height: 80 };
        setCrop(initialCrop);
      });
    },
    [aspectRatio],
  );

  const handleApply = () => {
    const img = imgRef.current;
    if (!img || !completedCrop) return;

    setApplying(true);
    cropImageToBlob(img, completedCrop, (blob) => {
      setApplying(false);
      onCrop(blob);
      onClose();
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={applying ? () => undefined : onClose} size="md">
      <ModalHeader onClose={applying ? undefined : onClose}>
        Crop Photo
      </ModalHeader>

      <ModalBody className="!p-0">
        {/* Crop area */}
        <div className="flex items-center justify-center bg-[#1A1A1A] p-4 min-h-[240px] max-h-[400px] overflow-hidden">
          {isOpen && (
            <ReactCrop
              crop={crop}
              onChange={(px, pct) => setCrop(pct)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              ruleOfThirds
              style={{ maxHeight: 380 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Crop preview"
                onLoad={handleImageLoad}
                style={{
                  transform:  `rotate(${rotation}deg) scale(${scale})`,
                  maxWidth:   '100%',
                  maxHeight:  '370px',
                  transition: 'transform 0.15s ease',
                }}
              />
            </ReactCrop>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border flex-wrap">
          <button
            type="button"
            onClick={() => setRotation((r) => r - 90)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-secondary border border-border rounded-button hover:bg-background transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Rotate Left
          </button>
          <button
            type="button"
            onClick={() => setRotation((r) => r + 90)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-secondary border border-border rounded-button hover:bg-background transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Rotate Right
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(s + 0.1, 3))}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-secondary border border-border rounded-button hover:bg-background transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            Zoom In
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-secondary border border-border rounded-button hover:bg-background transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
            Zoom Out
          </button>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={applying}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleApply}
          loading={applying}
          disabled={!completedCrop}
        >
          Apply Crop
        </Button>
      </ModalFooter>
    </Modal>
  );
}
