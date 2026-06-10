import { create } from 'zustand';
import { API_ROUTES } from '@mlh/constants';
import { apiClient, API_BASE } from '../api-client';
import type {
  ArtStyle,
  CustomizationPayload,
  CustomizationTemplate,
  FieldValue,
} from '../customizer/types';
import { MAX_HISTORY } from '../customizer/types';

// fabric.Canvas stored as unknown — typed at usage sites to avoid SSR-breaking imports
type FabricCanvasInstance = unknown;

type FieldValues = Record<string, FieldValue>;

interface CustomizerStore {
  // Config
  template:  CustomizationTemplate | null;
  productId: string | null;
  variantId: string | null;

  // Field state
  fieldValues: FieldValues;

  // ── Bundle support ─────────────────────────────────────────────────────────
  /** Total items in bundle (1 = single, 2+ = bundle like Couples Mug Set) */
  bundleCount:     number;
  /** Index of the item currently being edited (0-based) */
  activeItemIndex: number;
  /** Per-item field values: itemFields[0] = first item, itemFields[1] = second, etc. */
  itemFields:      Record<number, Record<string, FieldValue>>;

  // UI state
  activeFieldId:       string | null;
  isPreviewOpen:       boolean;
  previewImageUrl:     string | null;
  isGeneratingPreview: boolean;
  previewError:        string | null;

  // Fabric.js canvas ref (set by Canvas component)
  fabricCanvas: FabricCanvasInstance;

  // Undo / Redo
  history:      FieldValues[];
  historyIndex: number;

  // ── Actions ─────────────────────────────────────────────────────────────────
  initTemplate:    (template: CustomizationTemplate, productId: string, variantId: string | null) => void;

  // Bundle actions
  setActiveItem:   (index: number) => void;
  setItemField:    (itemIndex: number, fieldId: string, value: FieldValue) => void;
  getItemData:     (itemIndex: number) => Record<string, FieldValue>;
  setFieldValue:   (fieldId: string, value: Partial<FieldValue>) => void;
  setActiveField:  (fieldId: string | null) => void;
  setVariant:      (variantId: string) => void;
  setFabricCanvas: (canvas: FabricCanvasInstance) => void;

  uploadImage:      (fieldId: string, file: File) => Promise<void>;
  removeBackground: (fieldId: string) => Promise<void>;
  applyArtStyle:    (fieldId: string, style: ArtStyle) => Promise<void>;
  revertToOriginal: (fieldId: string) => void;

  generatePreview: () => Promise<void>;
  closePreview:    () => void;

  undo:    () => void;
  redo:    () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  autoFill: (savedData: FieldValues) => void;
  reset:    () => void;

  // Computed
  isValid:                () => boolean;
  toCustomizationPayload: () => CustomizationPayload;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function snapshot(fv: FieldValues): FieldValues {
  return structuredClone(fv);
}

function pushHistory(
  history: FieldValues[],
  idx: number,
  fv: FieldValues,
): { history: FieldValues[]; historyIndex: number } {
  const next = [...history.slice(0, idx + 1), snapshot(fv)].slice(-MAX_HISTORY);
  return { history: next, historyIndex: next.length - 1 };
}


async function pollJob(
  jobId: string,
  intervalMs = 2000,
  timeoutMs = 65_000,
): Promise<{ processedKey: string; processedUrl: string }> {
  const controller = new AbortController();
  let settled = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  return new Promise((resolve, reject) => {
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      controller.abort();
      clearTimeout(timer);
      if (intervalId) clearInterval(intervalId);
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => reject(new Error('Job timed out')));
    }, timeoutMs);

    intervalId = setInterval(async () => {
      if (settled) return;
      try {
        const job = await apiClient.get<{ status: string; processedKey?: string; processedUrl?: string }>(
          API_ROUTES.CUSTOMIZATION.JOB_STATUS(jobId),
          { signal: controller.signal },
        );
        if (job.status === 'done' && job.processedKey && job.processedUrl) {
          settle(() => resolve({ processedKey: job.processedKey!, processedUrl: job.processedUrl! }));
        } else if (job.status === 'failed') {
          settle(() => reject(new Error('Job failed')));
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        settle(() => reject(err));
      }
    }, intervalMs);
  });
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useCustomizerStore = create<CustomizerStore>((set, get) => ({
  template:            null,
  productId:           null,
  variantId:           null,
  fieldValues:         {},
  bundleCount:         1,
  activeItemIndex:     0,
  itemFields:          {},
  activeFieldId:       null,
  isPreviewOpen:       false,
  previewImageUrl:     null,
  isGeneratingPreview: false,
  previewError:        null,
  fabricCanvas:        null,
  history:             [{}],
  historyIndex:        0,

  // ── Init ──────────────────────────────────────────────────────────────────

  initTemplate: (template, productId, variantId) => {
    const defaults: FieldValues = {};
    template.fields.forEach((f) => {
      if (f.type === 'text' || f.type === 'date') {
        defaults[f.id] = { text: f.defaultValue ?? '' };
      } else if (f.type === 'select') {
        defaults[f.id] = { selectValue: f.defaultValue ?? '' };
      } else {
        defaults[f.id] = {};
      }
    });
    set({ template, productId, variantId, fieldValues: defaults, history: [defaults], historyIndex: 0 });
  },

  // ── Bundle actions ────────────────────────────────────────────────────────

  setActiveItem: (index) => set({ activeItemIndex: index }),

  setItemField: (itemIndex, fieldId, value) => {
    set((s) => ({
      itemFields: {
        ...s.itemFields,
        [itemIndex]: {
          ...(s.itemFields[itemIndex] ?? {}),
          [fieldId]: { ...(s.itemFields[itemIndex]?.[fieldId] ?? {}), ...value },
        },
      },
    }));
  },

  getItemData: (itemIndex) => get().itemFields[itemIndex] ?? {},

  // ── Field mutations ───────────────────────────────────────────────────────

  setFieldValue: (fieldId, value) => {
    set((s) => {
      const fv = { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], ...value } };
      return { fieldValues: fv, ...pushHistory(s.history, s.historyIndex, fv) };
    });
  },

  setActiveField: (fieldId) => set({ activeFieldId: fieldId }),

  setVariant: (variantId) => set({ variantId }),

  setFabricCanvas: (canvas) => set({ fabricCanvas: canvas }),

  // ── Upload image ──────────────────────────────────────────────────────────

  uploadImage: async (fieldId, file) => {
    set((s) => ({
      fieldValues: { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], isUploading: true, uploadProgress: 0, error: undefined } },
    }));

    const formData = new FormData();
    formData.append('file', file);

    const uploadWithProgress = (): Promise<{ tempKey: string; tempUrl: string; width: number; height: number }> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            set((s) => ({
              fieldValues: { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], uploadProgress: Math.round((e.loaded / e.total) * 100) } },
            }));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const body = JSON.parse(xhr.responseText);
              resolve(body?.data ?? body);
            } catch {
              reject(new Error('Invalid response'));
            }
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('POST', `${API_BASE}/api/v1${API_ROUTES.CUSTOMIZATION.UPLOAD}`);
        xhr.withCredentials = true;
        xhr.send(formData);
      });

    try {
      const result = await uploadWithProgress();
      set((s) => {
        const fv = { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], isUploading: false, uploadProgress: 100, imageKey: result.tempKey, imageUrl: result.tempUrl } };
        return { fieldValues: fv, ...pushHistory(s.history, s.historyIndex, fv) };
      });
    } catch (err) {
      set((s) => ({
        fieldValues: { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], isUploading: false, error: err instanceof Error ? err.message : 'Upload failed' } },
      }));
    }
  },

  // ── Remove background ─────────────────────────────────────────────────────

  removeBackground: async (fieldId) => {
    const { fieldValues } = get();
    const imageKey = fieldValues[fieldId]?.imageKey;
    if (!imageKey) return;

    set((s) => ({
      fieldValues: { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], isUploading: true, error: undefined } },
    }));

    try {
      const { jobId } = await apiClient.post<{ jobId: string }>(
        API_ROUTES.CUSTOMIZATION.REMOVE_BG,
        { imageKey },
      );

      const { processedKey, processedUrl } = await pollJob(jobId);

      set((s) => {
        const fv = { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], isUploading: false, processedImageKey: processedKey, processedImageUrl: processedUrl, bgRemoved: true } };
        return { fieldValues: fv, ...pushHistory(s.history, s.historyIndex, fv) };
      });
    } catch (err) {
      set((s) => ({
        fieldValues: { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], isUploading: false, error: err instanceof Error ? err.message : 'Background removal failed' } },
      }));
    }
  },

  // ── Apply art style ───────────────────────────────────────────────────────

  applyArtStyle: async (fieldId, style) => {
    const { fieldValues } = get();
    const imageKey = fieldValues[fieldId]?.imageKey;
    if (!imageKey) return;

    set((s) => ({
      fieldValues: { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], isUploading: true, error: undefined } },
    }));

    try {
      const { jobId } = await apiClient.post<{ jobId: string }>(
        API_ROUTES.CUSTOMIZATION.APPLY_ART_STYLE,
        { imageKey, style },
      );

      const { processedKey, processedUrl } = await pollJob(jobId);

      set((s) => {
        const fv = { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], isUploading: false, processedImageKey: processedKey, processedImageUrl: processedUrl, artStyle: style } };
        return { fieldValues: fv, ...pushHistory(s.history, s.historyIndex, fv) };
      });
    } catch (err) {
      set((s) => ({
        fieldValues: { ...s.fieldValues, [fieldId]: { ...s.fieldValues[fieldId], isUploading: false, error: err instanceof Error ? err.message : 'Art style failed' } },
      }));
    }
  },

  // ── Revert ────────────────────────────────────────────────────────────────

  revertToOriginal: (fieldId) => {
    set((s) => {
      const fv = {
        ...s.fieldValues,
        [fieldId]: {
          ...s.fieldValues[fieldId],
          processedImageKey: undefined,
          processedImageUrl: undefined,
          bgRemoved: false,
          artStyle:  undefined,
        },
      };
      return { fieldValues: fv, ...pushHistory(s.history, s.historyIndex, fv) };
    });
  },

  // ── Preview ───────────────────────────────────────────────────────────────

  generatePreview: async () => {
    const { template, fieldValues } = get();
    if (!template) return;

    set({ isGeneratingPreview: true, previewError: null, isPreviewOpen: true });

    try {
      const fields: Record<string, unknown> = {};
      template.fields.forEach((field) => {
        const val = fieldValues[field.id];
        if (!val) return;
        if (field.type === 'text' || field.type === 'date') {
          fields[field.id] = val.text ?? '';
        } else if (field.type === 'image') {
          fields[field.id] = { imageKey: val.imageKey, processedImageKey: val.processedImageKey, bgRemoved: val.bgRemoved, artStyle: val.artStyle };
        } else if (field.type === 'select') {
          fields[field.id] = val.selectValue ?? '';
        }
      });

      const { previewUrl } = await apiClient.post<{ previewUrl: string }>(
        API_ROUTES.CUSTOMIZATION.PREVIEW,
        { templateId: template.id, fields },
      );

      set({ isGeneratingPreview: false, previewImageUrl: previewUrl });
    } catch (err) {
      set({ isGeneratingPreview: false, previewError: err instanceof Error ? err.message : 'Preview failed' });
    }
  },

  closePreview: () => set({ isPreviewOpen: false }),

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  undo: () => {
    set((s) => {
      if (s.historyIndex <= 0) return s;
      const idx = s.historyIndex - 1;
      return { historyIndex: idx, fieldValues: s.history[idx] };
    });
  },

  redo: () => {
    set((s) => {
      if (s.historyIndex >= s.history.length - 1) return s;
      const idx = s.historyIndex + 1;
      return { historyIndex: idx, fieldValues: s.history[idx] };
    });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // ── Auto-fill / Reset ─────────────────────────────────────────────────────

  autoFill: (savedData) => {
    set((s) => {
      const fv = { ...s.fieldValues, ...savedData };
      return { fieldValues: fv, ...pushHistory(s.history, s.historyIndex, fv) };
    });
  },

  reset: () => {
    const { template, productId, variantId, initTemplate } = get();
    if (template && productId !== null) initTemplate(template, productId, variantId);
  },

  // ── Computed ──────────────────────────────────────────────────────────────

  isValid: () => {
    const { template, fieldValues } = get();
    if (!template) return false;
    return template.fields
      .filter((f) => f.required)
      .every((f) => {
        const val = fieldValues[f.id];
        if (!val) return false;
        if (f.type === 'text' || f.type === 'date') return Boolean(val.text?.trim());
        if (f.type === 'image') return Boolean(val.imageKey);
        if (f.type === 'select') return Boolean(val.selectValue);
        return true;
      });
  },

  toCustomizationPayload: (): CustomizationPayload => {
    const { template, fieldValues, previewImageUrl, variantId } = get();
    if (!template) throw new Error('No template');

    const fields: CustomizationPayload['fields'] = {};
    template.fields.forEach((field) => {
      const val = fieldValues[field.id];
      if (!val) return;
      if (field.type === 'text' || field.type === 'date') {
        fields[field.id] = { type: field.type, value: val.text ?? '' };
      } else if (field.type === 'image') {
        fields[field.id] = { type: 'image', value: val.imageKey ?? '', processedValue: val.processedImageKey, artStyle: val.artStyle, bgRemoved: val.bgRemoved };
      } else if (field.type === 'select') {
        fields[field.id] = { type: 'select', value: val.selectValue ?? '' };
      }
    });

    return { templateId: template.id, fields, previewUrl: previewImageUrl, variantId };
  },
}));
