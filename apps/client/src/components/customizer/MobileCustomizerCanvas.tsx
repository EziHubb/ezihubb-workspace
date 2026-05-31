'use client';

import { useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useCustomizerStore } from '../../lib/store/customizer.store';
import type { FabricCanvasHandle } from './FabricCanvas';
import type {
  TextField,
  DateField,
  ImageField,
  OverlayLayer,
  TemplateAngle,
} from '../../lib/customizer/types';

// Dynamic import — never runs on server
const FabricCanvas = dynamic(
  () => import('./FabricCanvas').then((m) => ({ default: m.FabricCanvas })),
  {
    ssr:     false,
    loading: () => (
      <div className="w-full aspect-square bg-[#2A2A2A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  },
);

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MobileCustomizerCanvasProps {
  activeAngle: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MobileCustomizerCanvas({ activeAngle }: MobileCustomizerCanvasProps) {
  const canvasRef   = useRef<FabricCanvasHandle>(null);
  const template    = useCustomizerStore((s) => s.template);
  const fieldValues = useCustomizerStore((s) => s.fieldValues);

  // ── Re-render canvas when angle or field values change ───────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !template) return;

    let cancelled = false;

    const render = async () => {
      // Base image for active angle
      const angleConfig: TemplateAngle | undefined = template.angles?.find(
        (a: TemplateAngle) => a.id === activeAngle,
      );
      const baseUrl =
        angleConfig?.baseUrl ??
        template.layers.find((l) => l.type === 'base')?.url ?? '';

      if (baseUrl) await canvas.loadBaseImage(baseUrl);
      if (cancelled) return;

      // Text / date / image fields
      for (const field of template.fields) {
        if (cancelled) break;
        const val = fieldValues[field.id];

        if (field.type === 'text' || field.type === 'date') {
          const cfg = (field as TextField | DateField).canvas;
          await canvas.updateTextField(field.id, val?.text ?? '', cfg);
        }

        if (field.type === 'image') {
          const cfg      = (field as ImageField).canvas;
          const imageUrl = val?.processedImageUrl ?? val?.imageUrl;
          if (imageUrl) {
            await canvas.updateImageField(field.id, imageUrl, cfg);
          } else {
            canvas.clearImageField(field.id);
          }
        }
      }

      if (cancelled) return;

      // Overlay layer (always on top)
      const overlayLayer = template.layers.find(
        (l) => l.type === 'overlay',
      ) as OverlayLayer | undefined;
      if (overlayLayer?.url) {
        await canvas.loadOverlayImage(overlayLayer.url);
      }
    };

    render().catch(console.error);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, activeAngle, fieldValues]);

  return (
    <div
      className="relative"
      style={{
        width:    'min(300px, 90vw)',
        aspectRatio: '1 / 1',
        filter:   'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
      }}
    >
      <FabricCanvas ref={canvasRef} className="rounded-md overflow-hidden" />
    </div>
  );
}
