/**
 * @jest-environment jsdom
 *
 * The temporal controller stores `<field>ms` on every feature of a layer so
 * its `between` guard can compare the time as a number (issue #2025). A layer
 * with two or more grammar layers is an OL layer group, which has no source of
 * its own, so the source has to be found through the document rather than
 * read off the map layer.
 *
 * The OL adapter itself is too heavy to construct here (it pulls in the whole
 * map, JupyterLab services and several ESM-only providers), so the test runs
 * the lookup and the conversion it delegates to, against the real layer
 * structure that grammarToOLLayer builds.
 */

jest.mock('@jupytergis/schema', () => ({}));
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('@/src/tools', () => ({ objectEntries: Object.entries }));

import { IJGISLayer } from '@jupytergis/schema';
import Feature from 'ol/Feature';
import { Point } from 'ol/geom';
import LayerGroup from 'ol/layer/Group';
import VectorImageLayer from 'ol/layer/VectorImage';
import VectorSource from 'ol/source/Vector';

import { grammarToOLLayer } from '@/src/mainview/adapters/openlayers/grammarToOLLayer';
import {
  setFeatureTimeMs,
  vectorSourceForLayer,
} from '@/src/mainview/utils/featureTimeMs';

const LAYER_ID = 'layer-1';
const SOURCE_ID = 'source-1';

function grammarLayer(id: string, color: number[]) {
  return {
    id,
    rules: [
      {
        id: `${id}-rule`,
        mappings: [
          {
            scale: { scheme: 'constant_rgba', params: { value: color } },
            encodings: ['fill-color'],
          },
        ],
      },
    ],
  };
}

function docLayer(grammarLayers: unknown[]): IJGISLayer {
  return {
    name: 'temporal',
    type: 'VectorLayer',
    visible: true,
    parameters: {
      source: SOURCE_ID,
      opacity: 1,
      symbologyState: { layers: grammarLayers },
    },
  } as unknown as IJGISLayer;
}

function makeSource(): VectorSource {
  return new VectorSource({
    features: [
      new Feature({ geometry: new Point([0, 0]), time: '2024-01-01' }),
      new Feature({ geometry: new Point([1, 1]), time: 1717200000000 }),
    ],
  });
}

const ascending = (a: number, b: number) => a - b;

function timesMs(source: VectorSource): number[] {
  return source
    .getFeatures()
    .map(f => f.get('timems') as number)
    .sort(ascending);
}

describe('vectorSourceForLayer', () => {
  it('finds the source of a layer with two grammar layers through the document', () => {
    const layer = docLayer([
      grammarLayer('gl-1', [255, 0, 0, 1]),
      grammarLayer('gl-2', [0, 0, 255, 1]),
    ]);
    const source = makeSource();
    const mapLayer = grammarToOLLayer({
      layer,
      layerId: LAYER_ID,
      source,
      featureValues: [],
      className: LAYER_ID,
    });
    // Two grammar layers compile to a group, which has no getSource().
    expect(mapLayer).toBeInstanceOf(LayerGroup);

    const resolved = vectorSourceForLayer(
      layer,
      mapLayer,
      new Map([[SOURCE_ID, source]]),
    );

    expect(resolved).toBe(source);
    setFeatureTimeMs(resolved!, 'time');
    expect(timesMs(source)).toEqual(
      [Date.parse('2024-01-01'), 1717200000000].sort(ascending),
    );
  });

  it('still resolves a single grammar layer', () => {
    const layer = docLayer([grammarLayer('gl-1', [255, 0, 0, 1])]);
    const source = makeSource();
    const mapLayer = grammarToOLLayer({
      layer,
      layerId: LAYER_ID,
      source,
      featureValues: [],
      className: LAYER_ID,
    });
    expect(mapLayer).not.toBeInstanceOf(LayerGroup);

    expect(
      vectorSourceForLayer(layer, mapLayer, new Map([[SOURCE_ID, source]])),
    ).toBe(source);
  });

  it('falls back to the map layer source when the document has none', () => {
    const source = makeSource();
    const mapLayer = new VectorImageLayer({ source });

    expect(vectorSourceForLayer(undefined, mapLayer, new Map())).toBe(source);
  });

  it('returns nothing for a group whose source is not a vector source', () => {
    const layer = docLayer([]);
    const group = new LayerGroup({ layers: [] });

    expect(
      vectorSourceForLayer(layer, group, new Map([[SOURCE_ID, {}]])),
    ).toBeUndefined();
  });
});

describe('setFeatureTimeMs', () => {
  it('parses ISO strings and keeps numbers', () => {
    const source = makeSource();

    setFeatureTimeMs(source, 'time');

    expect(timesMs(source)).toEqual(
      [Date.parse('2024-01-01'), 1717200000000].sort(ascending),
    );
  });
});
