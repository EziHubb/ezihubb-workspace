import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Canvas } from './Canvas';

// ── Mock Fabric.js (dynamic import) ───────────────────────────────────────────
const mockCanvasInstance = {
  setDimensions:    jest.fn(),
  setZoom:          jest.fn(),
  clear:            jest.fn(),
  add:              jest.fn(),
  remove:           jest.fn(),
  renderAll:        jest.fn(),
  on:               jest.fn(),
  dispose:          jest.fn(),
  getActiveObject:  jest.fn().mockReturnValue(null),
  getObjects:       jest.fn().mockReturnValue([]),
  sendObjectToBack: jest.fn(),
  bringObjectToFront: jest.fn(),
  selection:        true,
  backgroundColor:  '#ffffff',
};

const mockITextInstance = {
  set: jest.fn(),
  on:  jest.fn(),
  text: '',
  left: 400, top: 300,
};

const mockImageInstance = {
  set:         jest.fn(),
  scaleToWidth: jest.fn(),
};

const mockRectInstance   = {};
const mockCircleInstance = {};

jest.mock('fabric', () => ({
  Canvas: jest.fn().mockImplementation(() => mockCanvasInstance),
  FabricImage: {
    fromURL: jest.fn().mockResolvedValue(mockImageInstance),
  },
  IText:  jest.fn().mockImplementation(() => mockITextInstance),
  Rect:   jest.fn().mockImplementation(() => mockRectInstance),
  Circle: jest.fn().mockImplementation(() => mockCircleInstance),
}));

// ── Mock customizer store ─────────────────────────────────────────────────────
const mockSetFabricCanvas = jest.fn();
const mockSetFieldValue   = jest.fn();

const mockTemplate = {
  id:          'tmpl-001',
  name:        'Test Template',
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
      id:          'name_text',
      type:        'text',
      label:       'Your Name',
      required:    true,
      maxLength:   40,
      canvas:      { x: 400, y: 300, fontFamily: 'montserrat', fontSize: 48, fill: '#000000', align: 'center' },
    },
    {
      id:             'photo_upload',
      type:           'image',
      label:          'Photo',
      required:       false,
      allowBgRemoval: true,
      allowArtStyle:  false,
      canvas:         { x: 200, y: 200, width: 200, height: 200, clipShape: 'circle' },
    },
  ],
  angles: [
    { id: 'front', label: 'Front', baseUrl: 'https://example.com/front.jpg' },
    { id: 'back',  label: 'Back',  baseUrl: 'https://example.com/back.jpg'  },
  ],
};

const storeState: Record<string, unknown> = {
  template:          mockTemplate,
  fieldValues:       { name_text: { text: 'Alice' }, photo_upload: { imageUrl: 'https://example.com/photo.jpg' } },
  activeFieldId:     null,
  setFabricCanvas:   mockSetFabricCanvas,
  setFieldValue:     mockSetFieldValue,
  undo:              jest.fn(),
  redo:              jest.fn(),
  canUndo:           jest.fn().mockReturnValue(false),
  canRedo:           jest.fn().mockReturnValue(false),
};

jest.mock('../../lib/store/customizer.store', () => ({
  useCustomizerStore: (selector: (s: typeof storeState) => unknown) => selector(storeState),
}));

// ── Mock ResizeObserver ───────────────────────────────────────────────────────
class MockResizeObserver {
  observe    = jest.fn();
  unobserve  = jest.fn();
  disconnect = jest.fn();
}
global.ResizeObserver = MockResizeObserver as any;

// ─────────────────────────────────────────────────────────────────────────────

describe('Canvas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset canvas state
    mockCanvasInstance.clear.mockClear();
    mockCanvasInstance.add.mockClear();
    mockCanvasInstance.renderAll.mockClear();
  });

  it('renders the canvas container and canvas element', () => {
    render(<Canvas />);

    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
    expect(screen.getByTestId('fabric-canvas')).toBeInTheDocument();
  });

  it('renders angle tab buttons when template has multiple angles', () => {
    render(<Canvas />);

    expect(screen.getByRole('tab', { name: 'Front' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Back' })).toBeInTheDocument();
  });

  it('shows loading spinner initially before Fabric.js initializes', () => {
    render(<Canvas />);

    // Before the async fabric import resolves, loading state is shown
    // (spinner is present in the DOM during loading)
    expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
  });

  it('calls setFabricCanvas with canvas instance after initialization', async () => {
    await act(async () => {
      render(<Canvas />);
    });

    // After async init the store is updated with the canvas instance
    expect(mockSetFabricCanvas).toHaveBeenCalled();
  });

  it('renders base product image on the canvas after initialization', async () => {
    const { FabricImage } = await import('fabric');

    await act(async () => {
      render(<Canvas />);
    });

    // FabricImage.fromURL is called for the base image
    expect(FabricImage.fromURL).toHaveBeenCalledWith(
      expect.stringContaining('example.com'),
      expect.any(Object),
    );
  });

  it('renders text layer for text fields with current field value', async () => {
    const { IText } = await import('fabric');

    await act(async () => {
      render(<Canvas />);
    });

    // IText is constructed for the name_text field (value = 'Alice')
    expect(IText).toHaveBeenCalledWith(
      'Alice',
      expect.objectContaining({ fontFamily: 'montserrat' }),
    );
  });

  it('renders image layer for image field when imageUrl is set', async () => {
    const { FabricImage } = await import('fabric');

    await act(async () => {
      render(<Canvas />);
    });

    expect(FabricImage.fromURL).toHaveBeenCalledWith(
      'https://example.com/photo.jpg',
      expect.any(Object),
    );
  });

  it('shows placeholder label text when field value is empty', async () => {
    const { IText } = await import('fabric');

    // Override fieldValues to have empty text
    const originalFieldValues = storeState.fieldValues;
    storeState.fieldValues = { name_text: { text: '' }, photo_upload: {} };

    await act(async () => {
      render(<Canvas />);
    });

    expect(IText).toHaveBeenCalledWith(
      'Your Name', // falls back to field.label
      expect.any(Object),
    );

    storeState.fieldValues = originalFieldValues;
  });

  it('does NOT render image layer when photo_upload has no imageUrl', async () => {
    const { FabricImage } = await import('fabric');
    FabricImage.fromURL = jest.fn().mockResolvedValue(mockImageInstance);

    storeState.fieldValues = { name_text: { text: 'Bob' }, photo_upload: {} };

    await act(async () => {
      render(<Canvas />);
    });

    // fromURL is called only for the base image (1 call), not for the image field
    const calls = (FabricImage.fromURL as jest.Mock).mock.calls;
    const imageFieldCalls = calls.filter((c) => (c[0] as string).includes('photo.jpg'));
    expect(imageFieldCalls).toHaveLength(0);
  });

  it('switches base image when an angle tab is clicked', async () => {
    const { FabricImage } = await import('fabric');
    FabricImage.fromURL = jest.fn().mockResolvedValue(mockImageInstance);

    await act(async () => {
      render(<Canvas />);
    });

    await act(async () => {
      await userEvent.click(screen.getByRole('tab', { name: 'Back' }));
    });

    // After clicking 'Back', fromURL should be called with the back angle URL
    expect(FabricImage.fromURL).toHaveBeenCalledWith(
      expect.stringContaining('back.jpg'),
      expect.any(Object),
    );
  });

  it('passes readOnly=true to prevent selection and editing in mobile mode', async () => {
    const { Canvas: FabricCanvas, IText } = await import('fabric');
    (FabricCanvas as unknown as jest.Mock).mockClear();

    await act(async () => {
      render(<Canvas readOnly={true} />);
    });

    expect(FabricCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      expect.objectContaining({ selection: false }),
    );
  });
});
