/**
 * Unit tests for grammarToOLLayer's multi-layer ordering (issue #1477).
 *
 * The symbology UI lists grammar layers top-to-bottom and lets the user
 * reorder them (drag/arrows), with "top of the list" meaning "should render
 * on top of the map" — the same convention as the regular layer panel.
 *
 * OL layer/group/source classes are mocked (matching grammarToOLStyle.spec.ts's
 * approach) since importing real 'ol/source' pulls in ESM deps jest can't
 * transform. grammarToOLStyle is mocked so each compiled vector/raster
 * sublayer's style carries a marker identifying which grammar layer produced
 * it, independent of the style compiler's own (separately-tested) behavior.
 */

class MockVectorLayer {
  constructor(public opts: any) {}
}
class MockHeatmapLayer {
  constructor(public opts: any) {}
}
class MockWebGLLayer {
  constructor(public opts: any) {}
}

jest.mock('ol/layer', () => ({
  Heatmap: MockHeatmapLayer,
  VectorImage: MockVectorLayer,
  WebGLTile: MockWebGLLayer,
  Layer: MockVectorLayer,
}));
jest.mock('ol/layer/Group', () => ({
  __esModule: true,
  default: class MockGroup {
    constructor(public opts: any) {}
  },
}));
jest.mock('ol/source', () => ({ Vector: class {} }));
jest.mock('ol/style/flat', () => ({}));
jest.mock('@jupytergis/schema', () => ({}));
jest.mock('../styleBuilder', () => ({ DEFAULT_FLAT_STYLE: {} }));
jest.mock('../colorRampUtils', () => ({ getColorMap: jest.fn() }));
jest.mock('../grammarToOLStyle', () => ({
  grammarToOLStyle: jest.fn((state: any) => ({
    __marker: state.layers[0].id,
    'pixel-color': [state.layers[0].id],
  })),
}));

import { IGrammarSymbologyState } from '@jupytergis/schema';

import { grammarToOLLayer } from '../grammarToOLLayer';

function vectorMarkerOf(layer: MockVectorLayer): string {
  return layer.opts.style[0].style.__marker;
}

// compileRasterLayer wraps the mocked pixel-color array (our marker) inside
// a 'case' alpha-mask expression at index 3: ['case', cond, transparent, colorExpr].
function rasterMarkerOf(layer: MockWebGLLayer): string {
  return layer.opts.style.color[3][0];
}

describe('grammarToOLLayer — multi-layer render order (vector)', () => {
  it('renders the top-of-list grammar layer on top of the map', () => {
    const state: IGrammarSymbologyState = {
      layers: [
        { id: 'top', rules: [] },
        { id: 'bottom', rules: [] },
      ],
    } as any;

    const result = grammarToOLLayer(state, {} as any, 1, true) as any;

    // OL renders the last array entry on top, so the UI's top-of-list
    // grammar layer ('top') must end up last.
    expect(result.opts.layers.map(vectorMarkerOf)).toEqual(['bottom', 'top']);
  });

  it('reverses three or more grammar layers the same way', () => {
    const state: IGrammarSymbologyState = {
      layers: [
        { id: 'a', rules: [] },
        { id: 'b', rules: [] },
        { id: 'c', rules: [] },
      ],
    } as any;

    const result = grammarToOLLayer(state, {} as any, 1, true) as any;

    expect(result.opts.layers.map(vectorMarkerOf)).toEqual(['c', 'b', 'a']);
  });
});

describe('grammarToOLLayer — multi-layer render order (raster)', () => {
  it('renders the top-of-list grammar layer on top for WebGLTile layers too', () => {
    const state: IGrammarSymbologyState = {
      layers: [
        { id: 'top', rules: [] },
        { id: 'bottom', rules: [] },
      ],
    } as any;

    const result = grammarToOLLayer(
      state,
      { bandCount: 1 },
      1,
      true,
      [],
      true,
    ) as any;

    expect(result.opts.layers.map(rasterMarkerOf)).toEqual(['bottom', 'top']);
  });
});

describe('grammarToOLLayer — multi-layer render order (mixed vector + KDE)', () => {
  it('renders a points rule above a heatmap rule listed below it (issue #1477 repro)', () => {
    const state: IGrammarSymbologyState = {
      layers: [
        { id: 'points', rules: [] },
        {
          id: 'heat',
          rules: [],
          preprocess: [{ type: 'kde', weightField: undefined }],
        },
      ],
    } as any;

    const result = grammarToOLLayer(state, {} as any, 1, true) as any;
    const sublayers = result.opts.layers;

    expect(sublayers[0]).toBeInstanceOf(MockHeatmapLayer);
    expect(sublayers[1]).toBeInstanceOf(MockVectorLayer);
  });
});
