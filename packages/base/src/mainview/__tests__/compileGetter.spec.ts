jest.mock('@deck.gl/geo-layers', () => ({
  TileLayer: class {},
  TripsLayer: class {},
}));
jest.mock('@deck.gl/layers', () => ({
  BitmapLayer: class {},
  GeoJsonLayer: class {},
  PolygonLayer: class {},
}));
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
jest.mock('ol/style/flat', () => ({}));
jest.mock('@/src/tools', () => ({
  debounce: (fn: unknown) => fn,
  throttle: (fn: unknown) => fn,
  fetchWithProxies: jest.fn(),
}));
jest.mock('../CollaboratorPointers', () => ({}));

import { compileGetter } from '../adapters/deckgl/createDeckLayers';

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
