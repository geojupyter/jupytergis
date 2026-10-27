import type { Layer } from 'ol/layer';
import type LayerGroup from 'ol/layer/Group';
import { get as getProjection } from 'ol/proj';
import type Projection from 'ol/proj/Projection';
import type { Source } from 'ol/source';

import {
  getZoomExtentForOlLayer,
  isValidExtent,
  transformExtentToViewProjection,
} from '@/src/mainview/utils/olLayerZoomExtent';

const EPSG3857 = getProjection('EPSG:3857')!;
const EPSG4326 = getProjection('EPSG:4326')!;

function mockLayer(
  extent: number[] | undefined,
  projection: Projection = EPSG3857,
): Layer {
  return {
    getSource: () =>
      ({
        getProjection: () => projection,
        extent,
      }) as Source & { extent?: number[] },
  } as Layer;
}

function mockGroup(layers: Array<Layer | LayerGroup>): LayerGroup {
  return {
    getLayers: () => ({
      getArray: () => layers,
    }),
  } as LayerGroup;
}

function computeFromMockSource(
  _layer: Layer,
  source: Source | null,
): number[] | undefined {
  return (source as { extent?: number[] } | null)?.extent;
}

describe('isValidExtent', () => {
  it('accepts finite four-number extents', () => {
    expect(isValidExtent([0, 1, 2, 3])).toBe(true);
  });

  it('rejects non-finite values', () => {
    expect(isValidExtent([0, 1, Number.NaN, 3])).toBe(false);
    expect(isValidExtent(undefined)).toBe(false);
  });
});

describe('transformExtentToViewProjection', () => {
  it('returns the same array when projection codes match', () => {
    const extent = [0, 1, 2, 3];
    expect(transformExtentToViewProjection(extent, EPSG3857, EPSG3857)).toBe(
      extent,
    );
  });

  it('transforms when projection codes differ', () => {
    const wgs84Box = [-1, 51, 1, 52];
    const transformed = transformExtentToViewProjection(
      wgs84Box,
      EPSG3857,
      EPSG4326,
    );
    expect(transformed).not.toEqual(wgs84Box);
    expect(isValidExtent(transformed)).toBe(true);
  });
});

describe('getZoomExtentForOlLayer', () => {
  it('returns extent for a single layer', () => {
    expect(
      getZoomExtentForOlLayer(
        mockLayer([0, 0, 10, 10]),
        EPSG3857,
        computeFromMockSource,
      ),
    ).toEqual([0, 0, 10, 10]);
  });

  it('unions extents from sibling layers in a group', () => {
    expect(
      getZoomExtentForOlLayer(
        mockGroup([mockLayer([0, 0, 5, 5]), mockLayer([10, 10, 20, 20])]),
        EPSG3857,
        computeFromMockSource,
      ),
    ).toEqual([0, 0, 20, 20]);
  });

  it('walks nested layer groups', () => {
    expect(
      getZoomExtentForOlLayer(
        mockGroup([
          mockGroup([mockLayer([100, 100, 110, 110])]),
          mockLayer([0, 0, 5, 5]),
        ]),
        EPSG3857,
        computeFromMockSource,
      ),
    ).toEqual([0, 0, 110, 110]);
  });

  it('returns undefined when no child has an extent', () => {
    expect(
      getZoomExtentForOlLayer(
        mockLayer(undefined),
        EPSG3857,
        computeFromMockSource,
      ),
    ).toBeUndefined();
  });
});
