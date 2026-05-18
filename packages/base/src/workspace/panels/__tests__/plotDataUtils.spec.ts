/**
 * Tests for plotDataUtils — OL feature extraction producing clean Vega-Lite data.
 * OL is ESM and can't be loaded directly in Jest, so we use lightweight mocks
 * that match the OL API surface we depend on.
 */

import { featureToRow, sourceToRows } from '../plotDataUtils';

// ---------------------------------------------------------------------------
// Lightweight OL mocks — match the real API surface used by plotDataUtils
// ---------------------------------------------------------------------------

interface MockFeature {
  getProperties: () => Record<string, unknown>;
}

interface MockSource {
  forEachFeature: (cb: (f: MockFeature) => void) => void;
}

function makeFeature(props: Record<string, unknown>): MockFeature {
  return {
    getProperties: () => props,
  };
}

function makeVectorSource(features: MockFeature[]): MockSource {
  return {
    forEachFeature: (cb: (f: MockFeature) => void) => {
      features.forEach(cb);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('featureToRow', () => {
  it('extracts plain properties, stripping geometry', () => {
    const feature = makeFeature({
      geometry: { getType: () => 'Point' },
      mag: 2.3,
      felt: null,
    });

    const row = featureToRow(feature as any);

    // geometry should be stripped
    expect(row).toEqual({ mag: 2.3, felt: null });
    expect(row.geometry).toBeUndefined();
  });

  it('handles feature with no user properties', () => {
    const feature = makeFeature({ geometry: {} });

    const row = featureToRow(feature as any);
    expect(row).toEqual({});
  });

  it('preserves string, number, boolean, and null values', () => {
    const feature = makeFeature({
      geometry: {},
      name: 'quake',
      mag: 5.7,
      tsunami: 1,
      active: true,
      felt: null,
    });

    const row = featureToRow(feature as any);
    expect(row).toEqual({
      name: 'quake',
      mag: 5.7,
      tsunami: 1,
      active: true,
      felt: null,
    });
  });

  it('handles getProperties returning undefined/null gracefully', () => {
    const feature = {
      getProperties: () => undefined,
    };

    const row = featureToRow(feature as any);
    expect(row).toEqual({});
  });
});

describe('sourceToRows', () => {
  it('returns empty for null source', () => {
    expect(sourceToRows(null)).toEqual([]);
    expect(sourceToRows(undefined)).toEqual([]);
  });

  it('returns empty for source without forEachFeature', () => {
    expect(sourceToRows({ getFeatures: () => [] })).toEqual([]);
  });

  it('returns empty for empty vector source', () => {
    const source = makeVectorSource([]);
    expect(sourceToRows(source)).toEqual([]);
  });

  it('extracts rows from source with features, stripping geometry', () => {
    const source = makeVectorSource([
      makeFeature({ geometry: {}, mag: 2.3 }),
      makeFeature({ geometry: {}, mag: 5.1, felt: 12 }),
    ]);

    const rows = sourceToRows(source as any);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ mag: 2.3 });
    expect(rows[1]).toEqual({ mag: 5.1, felt: 12 });
  });

  it('strips geometry from all features', () => {
    const source = makeVectorSource([
      makeFeature({ geometry: {}, a: 1, b: 2 }),
    ]);

    const rows = sourceToRows(source as any);
    expect(rows[0]).toEqual({ a: 1, b: 2 });
  });
});
