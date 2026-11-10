jest.mock(
  '@deck.gl/geo-layers',
  () => ({
    TileLayer: class {},
    TripsLayer: class {
      props: unknown;
      constructor(props: unknown) {
        this.props = props;
      }
    },
  }),
  { virtual: true },
);
jest.mock(
  '@deck.gl/layers',
  () => ({
    BitmapLayer: class {},
    GeoJsonLayer: class {},
    PolygonLayer: class {
      props: unknown;
      constructor(props: unknown) {
        this.props = props;
      }
    },
  }),
  { virtual: true },
);
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('ol/style/flat', () => ({}));
jest.mock('@/src/tools', () => ({
  debounce: (fn: unknown) => fn,
  throttle: (fn: unknown) => fn,
  fetchWithProxies: jest.fn(),
}));
jest.mock('../CollaboratorPointers', () => ({}));

import type { IJGISSource } from '@jupytergis/schema';

import {
  compileGetter,
  createPolygonLayer,
  createTripsLayer,
  type IDeckLayerBuildContext,
} from '../adapters/deckgl/createDeckLayers';

const record = {
  path: [
    [0, 0],
    [1, 1],
  ],
  timestamps: [10, 20],
  height: 12,
  polygon: [
    [0, 0],
    [1, 0],
    [1, 1],
  ],
  nested: { value: 4 },
};

describe('compileGetter', () => {
  it('reads a bare property path from the record', () => {
    expect(compileGetter('height')(record)).toBe(12);
    expect(compileGetter('nested.value')(record)).toBe(4);
  });

  it('reads an arrow property path', () => {
    expect(compileGetter('d => d.path')(record)).toBe(record.path);
    expect(compileGetter('d => d.timestamps')(record)).toEqual([10, 20]);
    expect(compileGetter('(d) => d.height')(record)).toBe(12);
    expect(compileGetter('d => d.polygon')(record)).toBe(record.polygon);
    expect(compileGetter('d=>d.nested.value')(record)).toBe(4);
  });

  it('returns undefined when a step is missing', () => {
    expect(compileGetter('d => d.missing')(record)).toBeUndefined();
    expect(compileGetter('d => d.height.extra')(record)).toBeUndefined();
    expect(compileGetter('height')(null)).toBeUndefined();
  });

  it('rejects expressions that are not property paths', () => {
    expect(() => compileGetter('d => d.path()')).toThrow(/Unsupported getter/);
    expect(() => compileGetter('d => alert(1)')).toThrow(/Unsupported getter/);
    expect(() => compileGetter('() => d.path')).toThrow(/Unsupported getter/);
    expect(() => compileGetter('')).toThrow(/Unsupported getter/);
  });
});

function deckContext(
  records: unknown[],
  parameters: Record<string, string>,
): IDeckLayerBuildContext {
  return {
    jsonRecords: new Map([['src', records]]),
    geoJsonData: new Map(),
    tripTime: 0,
    getSource: () =>
      ({
        type: 'TripsSource',
        parameters,
      }) as IJGISSource,
    getter: expression => compileGetter(expression),
    tripTiming: () => ({ origin: 0, from: 0, to: 1 }),
    log: () => undefined,
  };
}

describe('source record fields', () => {
  const trip = {
    name: 'Trips',
    type: 'TripsLayer',
    visible: true,
    parameters: { source: 'src' },
  };
  const polygon = {
    name: 'Polygons',
    type: 'PolygonLayer',
    visible: true,
    parameters: { source: 'src' },
  };

  it('reads trip positions from the source field names', () => {
    const record = {
      route: [
        [0, 0],
        [1, 1],
      ],
      times: [1, 2],
    };
    const created = createTripsLayer(
      'layer',
      trip as never,
      deckContext([record], {
        pathField: 'route',
        timestampsField: 'times',
      }),
    );
    const props = (
      created?.layer as { props: { getPath: (row: unknown) => unknown } }
    ).props;

    expect(props.getPath(record)).toEqual(record.route);
  });

  it('falls back to path and timestamps when the source fields are unset', () => {
    const record = {
      path: [
        [0, 0],
        [1, 1],
      ],
      timestamps: [1, 2],
    };
    const created = createTripsLayer(
      'layer',
      trip as never,
      deckContext([record], {}),
    );

    expect(created).not.toBeNull();
  });

  it('reads polygon rings from the source field name', () => {
    const record = {
      ring: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    };
    const created = createPolygonLayer(
      'layer',
      polygon as never,
      deckContext([record], { polygonField: 'ring' }),
    );
    const props = (
      created as { props: { getPolygon: (row: unknown) => unknown } }
    ).props;

    expect(props.getPolygon(record)).toEqual(record.ring);
  });
});
