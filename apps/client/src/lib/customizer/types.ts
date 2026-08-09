// ── Constants ────────────────────────────────────────────────────────────────

export const CANVAS_LOGICAL_SIZE = 800;
export const MAX_HISTORY         = 20;

export const ALLOWED_FONTS = [
  { id: 'dancing-script',   label: 'Dancing Script',   url: '/fonts/DancingScript.woff2',   style: 'cursive'    },
  { id: 'playfair-display', label: 'Playfair Display',  url: '/fonts/PlayfairDisplay.woff2', style: 'serif'      },
  { id: 'montserrat',       label: 'Montserrat',        url: '/fonts/Montserrat.woff2',      style: 'sans-serif' },
  { id: 'pacifico',         label: 'Pacifico',          url: '/fonts/Pacifico.woff2',        style: 'cursive'    },
  { id: 'roboto-slab',      label: 'Roboto Slab',       url: '/fonts/RobotoSlab.woff2',      style: 'serif'      },
  { id: 'great-vibes',      label: 'Great Vibes',       url: '/fonts/GreatVibes.woff2',      style: 'cursive'    },
  { id: 'lato',             label: 'Lato',              url: '/fonts/Lato.woff2',            style: 'sans-serif' },
  { id: 'cinzel',           label: 'Cinzel',            url: '/fonts/Cinzel.woff2',          style: 'serif'      },
] as const;

// ── Template shape — shared with the API's server-side preview compositor ────
// so both sides agree on field positions/sizes without drifting.

export type {
  ArtStyle,
  BaseLayer,
  OverlayLayer,
  PrintAreaLayer,
  TemplateLayer,
  BaseField,
  CanvasTextConfig,
  TextField,
  CanvasImageConfig,
  ImageField,
  SelectOption,
  SelectField,
  DateField,
  TemplateField,
  TemplateAngle,
  CustomizationTemplate,
} from '@ezihubb/types';

export { DEMO_TEMPLATE } from '@ezihubb/types';

import type { ArtStyle } from '@ezihubb/types';

// ── Store field value ─────────────────────────────────────────────────────────

export interface FieldValue {
  text?:              string;
  imageKey?:          string;
  imageUrl?:          string;
  processedImageKey?: string;
  processedImageUrl?: string;
  artStyle?:          ArtStyle;
  selectValue?:       string;
  bgRemoved?:         boolean;
  isUploading?:       boolean;
  uploadProgress?:    number;
  error?:             string;
}

// ── Customization payload (sent to cart) ─────────────────────────────────────

export interface CustomizationPayload {
  templateId: string;
  fields: Record<string, {
    type:            'text' | 'image' | 'select' | 'date';
    value:           string;
    processedValue?: string;
    artStyle?:       string;
    bgRemoved?:      boolean;
  }>;
  previewUrl: string | null;
  variantId:  string | null;
}
