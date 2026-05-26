import { useCustomizerStore } from './customizer.store';
import type { CustomizationTemplate, FieldValue } from '../customizer/types';

// ── Test template ──────────────────────────────────────────────────────────────
const testTemplate: CustomizationTemplate = {
  id:           'tmpl-test-001',
  name:         'Test Mug',
  canvasWidth:  800,
  canvasHeight: 800,
  printWidth:   3000,
  printHeight:  3000,
  printDpi:     300,
  layers: [
    { type: 'base', url: 'https://example.com/base.jpg', lockMovement: true, selectable: false },
  ],
  fields: [
    {
      id:           'name_text',
      type:         'text',
      label:        'Your Name',
      required:     true,
      maxLength:    40,
      defaultValue: '',
      canvas:       { x: 400, y: 300, fontFamily: 'lato', fontSize: 48, fill: '#000000' },
    },
    {
      id:          'date_field',
      type:        'date',
      label:       'Date',
      required:    false,
      format:      'MM/DD/YYYY',
      canvas:      { x: 400, y: 380, fontFamily: 'lato', fontSize: 24, fill: '#666666' },
    },
    {
      id:             'photo_upload',
      type:           'image',
      label:          'Photo',
      required:       true,
      allowBgRemoval: true,
      allowArtStyle:  false,
      canvas:         { x: 200, y: 200, width: 200, height: 200, clipShape: 'circle' },
    },
    {
      id:           'style_pick',
      type:         'select',
      label:        'Style',
      required:     false,
      defaultValue: 'watercolor',
      options:      [{ value: 'watercolor', label: 'Watercolor' }, { value: 'cartoon', label: 'Cartoon' }],
    },
  ],
};

// ── Helper: reset store between tests ─────────────────────────────────────────
function getStore() {
  return useCustomizerStore.getState();
}

function resetStore() {
  useCustomizerStore.setState({
    template:            null,
    productId:           null,
    variantId:           null,
    fieldValues:         {},
    activeFieldId:       null,
    isPreviewOpen:       false,
    previewImageUrl:     null,
    isGeneratingPreview: false,
    previewError:        null,
    fabricCanvas:        null,
    history:             [{}],
    historyIndex:        0,
  });
}

describe('customizer.store', () => {
  beforeEach(resetStore);

  // ── initTemplate ───────────────────────────────────────────────────────────

  describe('initTemplate', () => {
    it('sets template and productId', () => {
      getStore().initTemplate(testTemplate, 'prod-001', null);

      const { template, productId } = getStore();
      expect(template?.id).toBe('tmpl-test-001');
      expect(productId).toBe('prod-001');
    });

    it('initialises fieldValues with defaults for each field', () => {
      getStore().initTemplate(testTemplate, 'prod-001', null);

      const { fieldValues } = getStore();
      expect(fieldValues['name_text']).toEqual({ text: '' });
      expect(fieldValues['date_field']).toEqual({ text: '' });
      expect(fieldValues['photo_upload']).toEqual({});
      expect(fieldValues['style_pick']).toEqual({ selectValue: 'watercolor' });
    });

    it('resets history to a single entry', () => {
      getStore().initTemplate(testTemplate, 'prod-001', null);

      const { history, historyIndex } = getStore();
      expect(history).toHaveLength(1);
      expect(historyIndex).toBe(0);
    });
  });

  // ── setFieldValue ──────────────────────────────────────────────────────────

  describe('setFieldValue', () => {
    beforeEach(() => getStore().initTemplate(testTemplate, 'prod-001', null));

    it('merges partial value into existing field entry', () => {
      getStore().setFieldValue('name_text', { text: 'Alice' });
      expect(getStore().fieldValues['name_text'].text).toBe('Alice');
    });

    it('pushes a history snapshot on each setFieldValue call', () => {
      getStore().setFieldValue('name_text', { text: 'A' });
      getStore().setFieldValue('name_text', { text: 'Al' });

      const { history, historyIndex } = getStore();
      expect(history.length).toBe(3); // init + 2 edits
      expect(historyIndex).toBe(2);
    });

    it('does not exceed MAX_HISTORY snapshots', () => {
      for (let i = 0; i < 25; i++) {
        getStore().setFieldValue('name_text', { text: String(i) });
      }
      expect(getStore().history.length).toBeLessThanOrEqual(20);
    });
  });

  // ── undo / redo ────────────────────────────────────────────────────────────

  describe('undo / redo', () => {
    beforeEach(() => {
      getStore().initTemplate(testTemplate, 'prod-001', null);
      getStore().setFieldValue('name_text', { text: 'First' });
      getStore().setFieldValue('name_text', { text: 'Second' });
    });

    it('canUndo returns true when there is history to revert', () => {
      expect(getStore().canUndo()).toBe(true);
    });

    it('canRedo returns false initially (no future state)', () => {
      expect(getStore().canRedo()).toBe(false);
    });

    it('undo reverts to the previous field value', () => {
      getStore().undo();
      expect(getStore().fieldValues['name_text'].text).toBe('First');
    });

    it('redo re-applies the reverted change', () => {
      getStore().undo();
      getStore().redo();
      expect(getStore().fieldValues['name_text'].text).toBe('Second');
    });

    it('canRedo becomes true after undo', () => {
      getStore().undo();
      expect(getStore().canRedo()).toBe(true);
    });

    it('undo at the initial state (historyIndex=0) does nothing', () => {
      getStore().undo(); // → First
      getStore().undo(); // → init
      getStore().undo(); // should be a no-op

      expect(getStore().historyIndex).toBe(0);
    });
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears fieldValues and history back to the template defaults', () => {
      getStore().initTemplate(testTemplate, 'prod-001', null);
      getStore().setFieldValue('name_text', { text: 'Alice' });

      getStore().reset();

      expect(getStore().fieldValues['name_text'].text).toBe('');
      expect(getStore().history).toHaveLength(1);
    });
  });

  // ── autoFill ───────────────────────────────────────────────────────────────

  describe('autoFill', () => {
    beforeEach(() => getStore().initTemplate(testTemplate, 'prod-001', null));

    it('merges saved data into current fieldValues', () => {
      const saved: Record<string, FieldValue> = {
        name_text:    { text: 'Saved Name' },
        photo_upload: { imageKey: 'key-123', imageUrl: 'https://example.com/photo.jpg' },
      };

      getStore().autoFill(saved);

      expect(getStore().fieldValues['name_text'].text).toBe('Saved Name');
      expect(getStore().fieldValues['photo_upload'].imageKey).toBe('key-123');
    });

    it('adds a history snapshot so the auto-fill can be undone', () => {
      const prevLength = getStore().history.length;
      getStore().autoFill({ name_text: { text: 'Draft' } });

      expect(getStore().history.length).toBe(prevLength + 1);
    });
  });

  // ── isValid ────────────────────────────────────────────────────────────────

  describe('isValid', () => {
    beforeEach(() => getStore().initTemplate(testTemplate, 'prod-001', null));

    it('returns false when a required text field is empty', () => {
      expect(getStore().isValid()).toBe(false);
    });

    it('returns true when all required fields have values', () => {
      getStore().setFieldValue('name_text',    { text: 'Alice' });
      getStore().setFieldValue('photo_upload', { imageKey: 'key-abc' });

      expect(getStore().isValid()).toBe(true);
    });

    it('returns false when required image field has no imageKey', () => {
      getStore().setFieldValue('name_text', { text: 'Alice' });
      // photo_upload still missing

      expect(getStore().isValid()).toBe(false);
    });

    it('ignores optional fields when checking validity', () => {
      getStore().setFieldValue('name_text',    { text: 'Alice' });
      getStore().setFieldValue('photo_upload', { imageKey: 'key-abc' });
      // date_field and style_pick are optional — should not affect validity

      expect(getStore().isValid()).toBe(true);
    });
  });

  // ── toCustomizationPayload ─────────────────────────────────────────────────

  describe('toCustomizationPayload', () => {
    beforeEach(() => {
      getStore().initTemplate(testTemplate, 'prod-001', 'variant-001');
      getStore().setFieldValue('name_text',    { text: 'Alice' });
      getStore().setFieldValue('photo_upload', { imageKey: 'key-abc', bgRemoved: true });
      getStore().setFieldValue('style_pick',   { selectValue: 'watercolor' });
    });

    it('builds a correct CustomizationPayload', () => {
      useCustomizerStore.setState({ previewImageUrl: 'https://example.com/preview.jpg' });

      const payload = getStore().toCustomizationPayload();

      expect(payload.templateId).toBe('tmpl-test-001');
      expect(payload.variantId).toBe('variant-001');
      expect(payload.previewUrl).toBe('https://example.com/preview.jpg');
      expect(payload.fields['name_text']).toEqual({ type: 'text', value: 'Alice' });
      expect(payload.fields['photo_upload']).toMatchObject({ type: 'image', value: 'key-abc', bgRemoved: true });
      expect(payload.fields['style_pick']).toEqual({ type: 'select', value: 'watercolor' });
    });

    it('throws when no template is loaded', () => {
      resetStore(); // wipes template
      expect(() => getStore().toCustomizationPayload()).toThrow('No template');
    });
  });

  // ── setActiveField ─────────────────────────────────────────────────────────

  describe('setActiveField', () => {
    it('sets and clears the active field id', () => {
      getStore().setActiveField('name_text');
      expect(getStore().activeFieldId).toBe('name_text');

      getStore().setActiveField(null);
      expect(getStore().activeFieldId).toBeNull();
    });
  });
});
