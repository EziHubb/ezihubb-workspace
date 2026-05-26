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

export type ArtStyle = 'watercolor' | 'van_gogh' | 'cartoon' | 'realistic' | 'sketch';

// ── Template layers ───────────────────────────────────────────────────────────

export interface BaseLayer {
  type:         'base';
  url:          string;
  lockMovement: true;
  selectable:   false;
}

export interface OverlayLayer {
  type:         'overlay';
  url:          string;
  lockMovement: true;
  selectable:   false;
}

export interface PrintAreaLayer {
  type:    'print_area';
  x:       number;
  y:       number;
  width:   number;
  height:  number;
  visible: false;
}

export type TemplateLayer = BaseLayer | OverlayLayer | PrintAreaLayer;

// ── Template fields ───────────────────────────────────────────────────────────

export interface BaseField {
  id:        string;
  label:     string;
  required:  boolean;
  helpText?: string;
}

export interface CanvasTextConfig {
  x:           number;
  y:           number;
  fontFamily:  string;
  fontSize:    number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?:  'normal' | 'italic';
  fill:        string;
  colorPicker?: boolean;
  align?:      'left' | 'center' | 'right';
  maxWidth?:   number;
}

export interface TextField extends BaseField {
  type:          'text';
  placeholder?:  string;
  maxLength:     number;
  defaultValue?: string;
  canvas:        CanvasTextConfig;
}

export interface CanvasImageConfig {
  x:             number;
  y:             number;
  width:         number;
  height:        number;
  clipShape?:    'rect' | 'circle';
  borderRadius?: number;
}

export interface ImageField extends BaseField {
  type:           'image';
  allowBgRemoval: boolean;
  allowArtStyle:  boolean;
  artStyles?:     ArtStyle[];
  canvas:         CanvasImageConfig;
}

export interface SelectOption {
  value:       string;
  label:       string;
  previewUrl?: string;
}

export interface SelectField extends BaseField {
  type:          'select';
  options:       SelectOption[];
  defaultValue?: string;
}

export interface DateField extends BaseField {
  type:          'date';
  format:        string;
  defaultValue?: string;
  canvas:        CanvasTextConfig;
}

export type TemplateField = TextField | ImageField | SelectField | DateField;

export interface TemplateAngle {
  id:      string;
  label:   string;
  baseUrl: string;
}

export interface CustomizationTemplate {
  id:           string;
  name:         string;
  canvasWidth:  number;
  canvasHeight: number;
  printWidth:   number;
  printHeight:  number;
  printDpi:     number;
  layers:       TemplateLayer[];
  fields:       TemplateField[];
  angles?:      TemplateAngle[];
}

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

// ── Demo template (used on product page when no real template is loaded) ──────

export const DEMO_TEMPLATE: CustomizationTemplate = {
  id:           'tmpl_mug_001',
  name:         'Classic Photo Mug',
  canvasWidth:  800,
  canvasHeight: 800,
  printWidth:   3000,
  printHeight:  3000,
  printDpi:     300,
  layers: [
    {
      type:         'base',
      url:          'https://placehold.co/800x800/FFF0EC/E85D3F?text=Mug+Preview',
      lockMovement: true,
      selectable:   false,
    },
    {
      type:         'overlay',
      url:          'https://placehold.co/800x800/00000000/00000000?text=',
      lockMovement: true,
      selectable:   false,
    },
  ],
  fields: [
    {
      id:          'name_text',
      type:        'text',
      label:       'Your Name(s)',
      required:    true,
      placeholder: 'e.g. John & Sarah',
      maxLength:   40,
      helpText:    'Up to 40 characters',
      canvas: {
        x:          400,
        y:          300,
        fontFamily: 'dancing-script',
        fontSize:   60,
        fontWeight: 'bold',
        fill:       '#2D2D2D',
        align:      'center',
        colorPicker: true,
        maxWidth:   600,
      },
    },
    {
      id:          'anniversary_date',
      type:        'date',
      label:       'Special Date',
      required:    false,
      format:      'MMMM DD, YYYY',
      helpText:    'Leave blank to skip',
      canvas: {
        x:          400,
        y:          390,
        fontFamily: 'montserrat',
        fontSize:   28,
        fill:       '#6B6B6B',
        align:      'center',
      },
    },
    {
      id:             'photo_upload',
      type:           'image',
      label:          'Your Photo',
      required:       false,
      allowBgRemoval: true,
      allowArtStyle:  true,
      artStyles:      ['watercolor', 'cartoon', 'van_gogh', 'realistic'],
      helpText:       'JPG, PNG or WebP, max 10MB',
      canvas: {
        x:         160,
        y:         160,
        width:     200,
        height:    200,
        clipShape: 'circle',
      },
    },
    {
      id:          'message_text',
      type:        'text',
      label:       'Personal Message',
      required:    false,
      placeholder: 'Add a heartfelt message...',
      maxLength:   100,
      canvas: {
        x:          400,
        y:          550,
        fontFamily: 'lato',
        fontSize:   24,
        fill:       '#6B6B6B',
        align:      'center',
        maxWidth:   640,
      },
    },
    {
      id:           'art_style',
      type:         'select',
      label:        'Art Style',
      required:     false,
      defaultValue: '',
      options: [
        { value: 'watercolor', label: 'Watercolor', previewUrl: 'https://placehold.co/200x200/dbeafe/1e40af?text=Watercolor' },
        { value: 'cartoon',    label: 'Cartoon',    previewUrl: 'https://placehold.co/200x200/fef9c3/854d0e?text=Cartoon'    },
        { value: 'van_gogh',   label: 'Van Gogh',   previewUrl: 'https://placehold.co/200x200/ede9fe/5b21b6?text=Van+Gogh'  },
        { value: 'realistic',  label: 'Realistic',  previewUrl: 'https://placehold.co/200x200/dcfce7/166534?text=Realistic'  },
      ],
    },
  ],
  angles: [
    { id: 'front', label: 'Front', baseUrl: 'https://placehold.co/800x800/FFF0EC/E85D3F?text=Front+View' },
    { id: 'side',  label: 'Side',  baseUrl: 'https://placehold.co/800x800/FFF0EC/C44A2E?text=Side+View'  },
    { id: 'back',  label: 'Back',  baseUrl: 'https://placehold.co/800x800/FFF0EC/2D2D2D?text=Back+View'  },
  ],
};
