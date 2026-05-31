'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { CANVAS_LOGICAL_SIZE } from '../../lib/customizer/types';
import type { CanvasTextConfig, CanvasImageConfig } from '../../lib/customizer/types';

// ── Public handle ─────────────────────────────────────────────────────────────

export interface FabricCanvasHandle {
  loadBaseImage(url: string): Promise<void>;
  loadOverlayImage(url: string): Promise<void>;
  updateTextField(fieldId: string, text: string, config: CanvasTextConfig): Promise<void>;
  clearTextField(fieldId: string): void;
  updateImageField(fieldId: string, imageUrl: string, config: CanvasImageConfig): Promise<void>;
  clearImageField(fieldId: string): void;
  exportPreview(): string | null;
  renderAll(): void;
}

// ── Internal fabric instance type (loose, to avoid importing fabric at module level) ──

type AnyFabric = Record<string, unknown>;

// ── Component ─────────────────────────────────────────────────────────────────

export interface FabricCanvasProps {
  className?: string;
}

export const FabricCanvas = forwardRef<FabricCanvasHandle, FabricCanvasProps>(
  function FabricCanvas({ className = '' }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasElRef  = useRef<HTMLCanvasElement>(null);
    const fabricRef    = useRef<AnyFabric | null>(null);
    const objectsMap   = useRef<Map<string, AnyFabric>>(new Map());
    const readyRef     = useRef(false);

    // ── Init Fabric.js ───────────────────────────────────────────────────────

    useEffect(() => {
      if (!canvasElRef.current) return;
      let cancelled = false;

      (async () => {
        const { Canvas: FC } = await import('fabric');
        if (cancelled || !canvasElRef.current) return;

        const canvas = new FC(canvasElRef.current, {
          width:                   CANVAS_LOGICAL_SIZE,
          height:                  CANVAS_LOGICAL_SIZE,
          selection:               false,
          preserveObjectStacking:  true,
          backgroundColor:         '#ffffff',
        });

        fabricRef.current = canvas as unknown as AnyFabric;
        readyRef.current  = true;
      })().catch(console.error);

      return () => {
        cancelled = true;
        if (fabricRef.current) {
          (fabricRef.current as { dispose: () => void }).dispose();
          fabricRef.current = null;
          readyRef.current  = false;
        }
      };
    }, []);

    // ── Responsive scaling ───────────────────────────────────────────────────

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !fabricRef.current) return;
        const w     = entry.contentRect.width;
        const scale = w / CANVAS_LOGICAL_SIZE;
        const fc = fabricRef.current as {
          setZoom: (s: number) => void;
          setDimensions: (d: { width: number; height: number }) => void;
        };
        fc.setZoom(scale);
        fc.setDimensions({ width: w, height: w });
      });

      ro.observe(container);
      return () => ro.disconnect();
    }, []);

    // ── Imperative handle ────────────────────────────────────────────────────

    useImperativeHandle(ref, () => ({
      async loadBaseImage(url: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const { FabricImage } = await import('fabric');

        const old = objectsMap.current.get('__base__');
        if (old) (canvas as { remove: (o: AnyFabric) => void }).remove(old);

        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        img.set({ left: 0, top: 0, selectable: false, evented: false,
                  lockMovementX: true, lockMovementY: true });
        (img as { scaleToWidth: (w: number) => void }).scaleToWidth(CANVAS_LOGICAL_SIZE);

        (canvas as { add: (o: AnyFabric) => void; sendObjectToBack: (o: AnyFabric) => void; renderAll: () => void }).add(img as unknown as AnyFabric);
        (canvas as { sendObjectToBack: (o: AnyFabric) => void }).sendObjectToBack(img as unknown as AnyFabric);
        objectsMap.current.set('__base__', img as unknown as AnyFabric);
        (canvas as { renderAll: () => void }).renderAll();
      },

      async loadOverlayImage(url: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const { FabricImage } = await import('fabric');

        const old = objectsMap.current.get('__overlay__');
        if (old) (canvas as { remove: (o: AnyFabric) => void }).remove(old);

        const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
        img.set({ left: 0, top: 0, selectable: false, evented: false, opacity: 0.85,
                  lockMovementX: true, lockMovementY: true });
        (img as { scaleToWidth: (w: number) => void }).scaleToWidth(CANVAS_LOGICAL_SIZE);
        (canvas as { add: (o: AnyFabric) => void; bringObjectToFront: (o: AnyFabric) => void }).add(img as unknown as AnyFabric);
        (canvas as { bringObjectToFront: (o: AnyFabric) => void }).bringObjectToFront(img as unknown as AnyFabric);
        objectsMap.current.set('__overlay__', img as unknown as AnyFabric);
        (canvas as { renderAll: () => void }).renderAll();
      },

      async updateTextField(fieldId: string, text: string, cfg: CanvasTextConfig) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const { IText } = await import('fabric');

        const old = objectsMap.current.get(fieldId);
        if (old) (canvas as { remove: (o: AnyFabric) => void }).remove(old);

        const itext = new IText(text || '', {
          left:       cfg.x,
          top:        cfg.y,
          fontFamily: cfg.fontFamily,
          fontSize:   cfg.fontSize,
          fontWeight: cfg.fontWeight ?? 'normal',
          fontStyle:  cfg.fontStyle  ?? 'normal',
          fill:       text ? cfg.fill : '#cccccc',
          textAlign:  cfg.align ?? 'left',
          selectable: false,
          editable:   false,
          originX:    'center',
          originY:    'center',
        });

        (canvas as { add: (o: AnyFabric) => void; renderAll: () => void }).add(itext as unknown as AnyFabric);
        objectsMap.current.set(fieldId, itext as unknown as AnyFabric);
        (canvas as { renderAll: () => void }).renderAll();
      },

      clearTextField(fieldId: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const old = objectsMap.current.get(fieldId);
        if (old) {
          (canvas as { remove: (o: AnyFabric) => void; renderAll: () => void }).remove(old);
          (canvas as { renderAll: () => void }).renderAll();
        }
        objectsMap.current.delete(fieldId);
      },

      async updateImageField(fieldId: string, imageUrl: string, cfg: CanvasImageConfig) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const { FabricImage, Rect, Circle } = await import('fabric');

        const old = objectsMap.current.get(fieldId);
        if (old) (canvas as { remove: (o: AnyFabric) => void }).remove(old);

        const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });

        const clipPath =
          cfg.clipShape === 'circle'
            ? new Circle({ radius: Math.min(cfg.width, cfg.height) / 2, originX: 'center', originY: 'center' })
            : new Rect({ width: cfg.width, height: cfg.height, originX: 'center', originY: 'center' });

        img.set({ left: cfg.x, top: cfg.y, originX: 'center', originY: 'center',
                  selectable: false, evented: false, clipPath: clipPath as unknown as AnyFabric });
        (img as { scaleToWidth: (w: number) => void }).scaleToWidth(cfg.width);

        (canvas as { add: (o: AnyFabric) => void; renderAll: () => void }).add(img as unknown as AnyFabric);
        objectsMap.current.set(fieldId, img as unknown as AnyFabric);
        (canvas as { renderAll: () => void }).renderAll();
      },

      clearImageField(fieldId: string) {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const old = objectsMap.current.get(fieldId);
        if (old) {
          (canvas as { remove: (o: AnyFabric) => void; renderAll: () => void }).remove(old);
          (canvas as { renderAll: () => void }).renderAll();
        }
        objectsMap.current.delete(fieldId);
      },

      exportPreview(): string | null {
        if (!fabricRef.current) return null;
        return (fabricRef.current as { toDataURL: (opts: Record<string, unknown>) => string }).toDataURL({
          format: 'jpeg',
          quality: 0.9,
          multiplier: 1,
        });
      },

      renderAll() {
        (fabricRef.current as { renderAll?: () => void } | null)?.renderAll?.();
      },
    }));

    return (
      <div
        ref={containerRef}
        className={['relative w-full overflow-hidden', className].filter(Boolean).join(' ')}
        style={{ aspectRatio: '1 / 1' }}
      >
        <canvas ref={canvasElRef} />
      </div>
    );
  },
);
