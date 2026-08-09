import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
const sharp = require('sharp');
import type {
  CustomizationTemplate,
  CanvasTextConfig,
  BaseLayer,
  OverlayLayer,
  PreviewFieldValue,
  PreviewImageFieldValue,
} from '@ezihubb/types';

// Real custom web fonts (Dancing Script, Playfair Display, etc.) aren't bundled
// into this container's fontconfig, and the client's own /fonts/*.woff2 files
// don't actually exist in the repo either (checked — same gap on both sides).
// Map each known font id to the closest generic CSS family by visual category
// so text at least renders in a plausible style until real font files exist.
const FONT_FAMILY_FALLBACK: Record<string, string> = {
  'dancing-script':   'cursive',
  'great-vibes':      'cursive',
  'pacifico':         'cursive',
  'playfair-display': 'serif',
  'roboto-slab':      'serif',
  'cinzel':           'serif',
  'montserrat':       'sans-serif',
  'lato':             'sans-serif',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTextSvg(canvasWidth: number, canvasHeight: number, cfg: CanvasTextConfig, text: string): Buffer {
  const anchor = cfg.align === 'left' ? 'start' : cfg.align === 'right' ? 'end' : 'middle';
  const fontFamily = FONT_FAMILY_FALLBACK[cfg.fontFamily] ?? 'sans-serif';
  const weight = cfg.fontWeight === 'bold' ? 'bold' : 'normal';
  const style = cfg.fontStyle === 'italic' ? 'italic' : 'normal';

  const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
    <text x="${cfg.x}" y="${cfg.y}" text-anchor="${anchor}" dominant-baseline="central"
      font-family="${fontFamily}" font-size="${cfg.fontSize}" font-weight="${weight}" font-style="${style}"
      fill="${cfg.fill}">${escapeXml(text)}</text>
  </svg>`;

  return Buffer.from(svg);
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer', timeout: 15_000 });
  return Buffer.from(res.data);
}

// Must match FabricCanvas.tsx's loadOverlayImage (opacity: 0.85) — the client
// renders the overlay layer at 85% opacity, not fully opaque. Skipping this
// made an all-white demo overlay wash out the entire composited image.
const OVERLAY_OPACITY = 0.85;

async function dimAlpha(buffer: Buffer, opacity: number): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += info.channels) {
    data[i] = Math.round(data[i] * opacity);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();
}

@Injectable()
export class TemplateCompositorService {
  private readonly logger = new Logger(TemplateCompositorService.name);

  /**
   * Renders a template + the customer's field values into a flat PNG preview.
   * `resolveImageUrl` turns an uploaded image's storage key into a fetchable URL
   * (kept as a callback so this service doesn't need to depend on StorageService's
   * specific key format).
   */
  async composite(
    template: CustomizationTemplate,
    fields: Record<string, PreviewFieldValue | undefined>,
    resolveImageUrl: (key: string) => string,
  ): Promise<Buffer> {
    const baseLayer = template.layers.find((l): l is BaseLayer => l.type === 'base');
    const overlayLayer = template.layers.find((l): l is OverlayLayer => l.type === 'overlay');
    if (!baseLayer) {
      throw new Error(`Template ${template.id} has no base layer`);
    }

    const baseBuffer = await fetchImageBuffer(baseLayer.url);
    const overlays: { input: Buffer; left: number; top: number }[] = [];

    for (const field of template.fields) {
      const value = fields[field.id];
      if (value == null || value === '') continue;

      if ((field.type === 'text' || field.type === 'date') && typeof value === 'string' && value.trim()) {
        overlays.push({
          input: buildTextSvg(template.canvasWidth, template.canvasHeight, field.canvas, value),
          left: 0,
          top: 0,
        });
        continue;
      }

      if (field.type === 'image' && typeof value === 'object') {
        const imgValue = value as PreviewImageFieldValue;
        const key = imgValue.processedImageKey ?? imgValue.imageKey;
        if (!key) continue;

        try {
          const { width, height, clipShape } = field.canvas;
          const rawBuffer = await fetchImageBuffer(resolveImageUrl(key));
          let img = sharp(rawBuffer).resize(width, height, { fit: 'cover' });

          if (clipShape === 'circle') {
            const radius = Math.min(width, height) / 2;
            const mask = Buffer.from(
              `<svg width="${width}" height="${height}"><circle cx="${width / 2}" cy="${height / 2}" r="${radius}" fill="#fff"/></svg>`,
            );
            img = img.composite([{ input: mask, blend: 'dest-in' }]);
          }

          overlays.push({
            input: await img.png().toBuffer(),
            left: Math.round(field.canvas.x - width / 2),
            top:  Math.round(field.canvas.y - height / 2),
          });
        } catch (err) {
          // A broken/missing uploaded image shouldn't block the rest of the preview.
          this.logger.warn(`Skipping image field "${field.id}" — ${(err as Error).message}`);
        }
      }
    }

    if (overlayLayer) {
      const overlayResized = await sharp(await fetchImageBuffer(overlayLayer.url))
        .resize(template.canvasWidth, template.canvasHeight, { fit: 'cover' })
        .toBuffer();
      overlays.push({ input: await dimAlpha(overlayResized, OVERLAY_OPACITY), left: 0, top: 0 });
    }

    return sharp(baseBuffer)
      .resize(template.canvasWidth, template.canvasHeight, { fit: 'cover' })
      .composite(overlays)
      .png()
      .toBuffer();
  }
}
