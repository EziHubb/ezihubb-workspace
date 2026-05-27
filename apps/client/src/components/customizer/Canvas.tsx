'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import { CANVAS_LOGICAL_SIZE } from '../../lib/customizer/types';
import type { TextField, DateField, ImageField, TemplateAngle } from '../../lib/customizer/types';

interface FabricCanvasWithKeyHandler extends FabricCanvasType {
  __keyHandler?: (e: KeyboardEvent) => void;
}

interface CanvasProps {
  readOnly?: boolean;
}

export function Canvas({ readOnly = false }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef  = useRef<HTMLCanvasElement>(null);
  const fabricRef    = useRef<FabricCanvasType | null>(null);

  const template       = useCustomizerStore((s) => s.template);
  const fieldValues    = useCustomizerStore((s) => s.fieldValues);
  const activeFieldId  = useCustomizerStore((s) => s.activeFieldId);
  const setFabricCanvas = useCustomizerStore((s) => s.setFabricCanvas);
  const undo           = useCustomizerStore((s) => s.undo);
  const redo           = useCustomizerStore((s) => s.redo);
  const canUndo        = useCustomizerStore((s) => s.canUndo);
  const canRedo        = useCustomizerStore((s) => s.canRedo);
  const setFieldValue  = useCustomizerStore((s) => s.setFieldValue);

  const [activeAngleId, setActiveAngleId] = useState<string>('');
  const [isLoading, setIsLoading]         = useState(true);

  // ── Bootstrap Fabric.js ────────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasElRef.current || !template) return;

    let cancelled = false;

    const init = async () => {
      const { Canvas: FabricCanvas } = await import('fabric');

      if (cancelled || !canvasElRef.current) return;

      const canvas = new FabricCanvas(canvasElRef.current, {
        width:               CANVAS_LOGICAL_SIZE,
        height:              CANVAS_LOGICAL_SIZE,
        selection:           !readOnly,
        preserveObjectStacking: true,
        backgroundColor:     '#ffffff',
      });

      fabricRef.current = canvas;
      setFabricCanvas(canvas as unknown);

      // Keyboard shortcuts (desktop only)
      if (!readOnly) {
        const handleKey = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault();
            if (e.shiftKey) { if (canRedo()) redo(); }
            else            { if (canUndo()) undo(); }
          }
          if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); if (canRedo()) redo(); }
          if (e.key === 'Delete' || e.key === 'Backspace') {
            const active = canvas.getActiveObject() as FabricObject | null;
            if (active && active.selectable) canvas.remove(active);
          }
          const arrowDelta = e.shiftKey ? 10 : 1;
          const active = canvas.getActiveObject();
          if (active && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
            e.preventDefault();
            if (e.key === 'ArrowLeft')  active.set('left', (active.left ?? 0) - arrowDelta);
            if (e.key === 'ArrowRight') active.set('left', (active.left ?? 0) + arrowDelta);
            if (e.key === 'ArrowUp')    active.set('top',  (active.top  ?? 0) - arrowDelta);
            if (e.key === 'ArrowDown')  active.set('top',  (active.top  ?? 0) + arrowDelta);
            canvas.renderAll();
          }
        };
        window.addEventListener('keydown', handleKey);
        (canvas as FabricCanvasWithKeyHandler).__keyHandler = handleKey;
      }

      // Initial angle
      const firstAngle = template.angles?.[0]?.id ?? '';
      setActiveAngleId(firstAngle);
      setIsLoading(false);
    };

    init().catch(console.error);

    return () => {
      cancelled = true;
      if (fabricRef.current) {
        const kh = (fabricRef.current as FabricCanvasWithKeyHandler).__keyHandler;
        if (kh) window.removeEventListener('keydown', kh);
        fabricRef.current.dispose();
        fabricRef.current = null;
        setFabricCanvas(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  // ── Responsive scaling via ResizeObserver ──────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || !fabricRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !fabricRef.current) return;
      const displayWidth = entry.contentRect.width;
      const scale = displayWidth / CANVAS_LOGICAL_SIZE;
      fabricRef.current.setZoom(scale);
      fabricRef.current.setDimensions({ width: displayWidth, height: displayWidth });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isLoading]);

  // ── Render layers when template / fieldValues / angle change ──────────────

  const renderLayers = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || !template) return;

    const { FabricImage, IText, Rect, Circle } = await import('fabric');

    canvas.clear();

    // ── Base image ───────────────────────────────────────────────────────────
    const baseUrl =
      template.angles?.find((a) => a.id === activeAngleId)?.baseUrl ??
      template.layers.find((l) => l.type === 'base')?.url ?? '';

    if (baseUrl) {
      const baseImg = await FabricImage.fromURL(baseUrl, { crossOrigin: 'anonymous' });
      baseImg.set({
        left:         0,
        top:          0,
        selectable:   false,
        evented:      false,
        lockMovementX: true,
        lockMovementY: true,
      });
      baseImg.scaleToWidth(CANVAS_LOGICAL_SIZE);
      canvas.add(baseImg);
      canvas.sendObjectToBack(baseImg);
    }

    // ── User content layers (text + image fields) ────────────────────────────
    for (const field of template.fields) {
      const val = fieldValues[field.id];

      if (field.type === 'text' || field.type === 'date') {
        const cfg   = (field as TextField | DateField).canvas;
        const text  = val?.text ?? '';
        const itext = new IText(text || field.label, {
          left:         cfg.x,
          top:          cfg.y,
          fontFamily:   cfg.fontFamily,
          fontSize:     cfg.fontSize,
          fontWeight:   cfg.fontWeight ?? 'normal',
          fontStyle:    cfg.fontStyle  ?? 'normal',
          fill:         text ? cfg.fill : '#cccccc',
          textAlign:    cfg.align ?? 'left',
          selectable:   !readOnly,
          editable:     !readOnly,
          originX:      'center',
          originY:      'center',
        });

        if (!readOnly) {
          itext.on('changed', () => {
            setFieldValue(field.id, { text: itext.text });
          });
          itext.on('editing:exited', () => {
            setFieldValue(field.id, { text: itext.text });
          });
        }

        canvas.add(itext);
      }

      if (field.type === 'image') {
        const cfg      = (field as ImageField).canvas;
        const imageUrl = val?.processedImageUrl ?? val?.imageUrl;

        if (imageUrl) {
          const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' });

          let clipPath: InstanceType<typeof Rect> | InstanceType<typeof Circle> | undefined;
          if (cfg.clipShape === 'circle') {
            clipPath = new Circle({ radius: Math.min(cfg.width, cfg.height) / 2, originX: 'center', originY: 'center' });
          } else {
            clipPath = new Rect({ width: cfg.width, height: cfg.height, originX: 'center', originY: 'center' });
          }

          img.set({
            left:        cfg.x,
            top:         cfg.y,
            originX:     'center',
            originY:     'center',
            selectable:  !readOnly,
            clipPath,
          });
          img.scaleToWidth(cfg.width);
          canvas.add(img);
        }
      }
    }

    // ── Overlay layer (always on top, locked) ────────────────────────────────
    const overlayLayer = template.layers.find((l) => l.type === 'overlay');
    if (overlayLayer?.url) {
      const overlayImg = await FabricImage.fromURL(overlayLayer.url, { crossOrigin: 'anonymous' });
      overlayImg.set({
        left:         0,
        top:          0,
        selectable:   false,
        evented:      false,
        lockMovementX: true,
        lockMovementY: true,
        opacity:       0.85,
      });
      overlayImg.scaleToWidth(CANVAS_LOGICAL_SIZE);
      canvas.add(overlayImg);
      canvas.bringObjectToFront(overlayImg);
    }

    canvas.renderAll();
  }, [template, fieldValues, activeAngleId, readOnly, setFieldValue]);

  useEffect(() => {
    if (!isLoading) renderLayers().catch(console.error);
  }, [isLoading, renderLayers]);

  // ── Angle tabs ─────────────────────────────────────────────────────────────

  const angles: TemplateAngle[] = template?.angles ?? [];

  return (
    <div className="flex flex-col w-full">
      {/* Angle tabs */}
      {angles.length > 1 && (
        <div className="flex gap-1 mb-2 px-1" role="tablist" aria-label="Product angles">
          {angles.map((angle) => (
            <button
              key={angle.id}
              role="tab"
              aria-selected={activeAngleId === angle.id}
              onClick={() => setActiveAngleId(angle.id)}
              className={[
                'px-3 py-1 text-xs font-medium rounded-sm transition-colors',
                activeAngleId === angle.id
                  ? 'bg-primary text-white'
                  : 'bg-background text-muted hover:text-secondary',
              ].join(' ')}
            >
              {angle.label}
            </button>
          ))}
        </div>
      )}

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden bg-[#F5F5F5] rounded-md"
        data-testid="canvas-container"
        style={{ aspectRatio: '1 / 1' }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        <canvas ref={canvasElRef} data-testid="fabric-canvas" />
      </div>
    </div>
  );
}
