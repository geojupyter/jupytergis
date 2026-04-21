// geotiff pulls in quick-lru (ESM-only); mock it since GeoTIFF classification
// is not under test here.
jest.mock('geotiff', () => ({ Pool: class {}, fromUrl: jest.fn() }));
// SingleBandPseudoColor imports OpenLayers (ESM); only its TypeScript type is
// used in classificationModes so mock the whole module to avoid pulling in OL.
jest.mock('../tiff_layer/types/SingleBandPseudoColor', () => ({}));

import { VectorClassifications } from '../classificationModes';

const {
  calculateEqualIntervalBreaks,
  calculateQuantileBreaks,
  calculateJenksBreaks,
  calculateLogarithmicBreaks,
  calculatePrettyBreaks,
} = VectorClassifications;

// All classification functions follow a linspace-like contract:
//   calculateXxx(values, nStops) → exactly nStops anchor points
//   including vmin as the first and vmax as the last.
// These stops are used as anchor points for a linear color gradient that spans
// the full [vmin, vmax] range.

describe('VectorClassifications.calculateEqualIntervalBreaks', () => {
  it('returns exactly nStops values', () => {
    expect(calculateEqualIntervalBreaks([0, 100], 6)).toHaveLength(6);
  });

  it('starts at vmin and ends at vmax', () => {
    const breaks = calculateEqualIntervalBreaks([0, 100], 6);
    expect(breaks[0]).toBe(0);
    expect(breaks[5]).toBe(100);
  });

  it('produces evenly spaced stops — [0,100] with 6 stops gives step 20', () => {
    expect(calculateEqualIntervalBreaks([0, 100], 6)).toEqual([
      0, 20, 40, 60, 80, 100,
    ]);
  });

  it('works for a non-zero vmin', () => {
    // [10, 40] / 3 intervals → step 10
    expect(calculateEqualIntervalBreaks([10, 40], 4)).toEqual([10, 20, 30, 40]);
  });
});

describe('VectorClassifications.calculateQuantileBreaks', () => {
  it('returns exactly nStops values', () => {
    expect(calculateQuantileBreaks([1, 2, 3, 4, 5], 5)).toHaveLength(5);
  });

  it('starts at vmin and ends at vmax', () => {
    const breaks = calculateQuantileBreaks([1, 2, 3, 4, 5], 5);
    expect(breaks[0]).toBe(1);
    expect(breaks[4]).toBe(5);
  });

  it('places stops at equal-count quantile boundaries for uniform data', () => {
    // [1,2,3,4,5] split into 4 equal-count intervals → integer boundaries
    expect(calculateQuantileBreaks([1, 2, 3, 4, 5], 5)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it('places the midpoint correctly for two stops', () => {
    // [10, 20] split by 1 interior quantile → midpoint at 15
    expect(calculateQuantileBreaks([10, 20], 3)).toEqual([10, 15, 20]);
  });
});

describe('VectorClassifications.calculateJenksBreaks', () => {
  it('returns [] for empty values', () => {
    expect(calculateJenksBreaks([], 3)).toEqual([]);
  });

  it('returns exactly nStops values', () => {
    expect(calculateJenksBreaks([1, 2, 10, 11], 3)).toHaveLength(3);
  });

  it('starts at vmin and ends at vmax', () => {
    const breaks = calculateJenksBreaks([1, 2, 10, 11], 3);
    expect(breaks[0]).toBe(1);
    expect(breaks[2]).toBe(11);
  });

  it('splits at the natural gap between clusters', () => {
    // {1,2} and {10,11} are the obvious two clusters; boundary is at 2
    expect(calculateJenksBreaks([1, 2, 10, 11], 3)).toEqual([1, 2, 11]);
  });
});

describe('VectorClassifications.calculateLogarithmicBreaks', () => {
  it('returns [] for empty input', () => {
    expect(calculateLogarithmicBreaks([], 5)).toEqual([]);
  });

  it('returns [] when all values are non-positive', () => {
    expect(calculateLogarithmicBreaks([-1, 0], 5)).toEqual([]);
  });

  it('returns exactly nStops values', () => {
    expect(calculateLogarithmicBreaks([1, 10000], 5)).toHaveLength(5);
  });

  it('produces clean decade stops for a 4-decade range with 5 stops', () => {
    // linspace in log space from 10^0 to 10^4 with 5 points → 1, 10, 100, 1000, 10000
    const breaks = calculateLogarithmicBreaks([1, 10000], 5);
    expect(breaks[0]).toBeCloseTo(1);
    expect(breaks[1]).toBeCloseTo(10);
    expect(breaks[2]).toBeCloseTo(100);
    expect(breaks[3]).toBeCloseTo(1000);
    expect(breaks[4]).toBeCloseTo(10000);
  });
});

describe('VectorClassifications.calculatePrettyBreaks', () => {
  it('snaps all stops to round values, including the endpoints', () => {
    // vmin=2.7 → pretty lower bound is 0 (start*unit); all stops are multiples of 20
    expect(calculatePrettyBreaks([2.7, 100], 6)).toEqual([
      0, 20, 40, 60, 80, 100,
    ]);
  });

  it('includes zero when the range crosses zero', () => {
    const breaks = calculatePrettyBreaks([-50, 50], 5);
    expect(breaks.some(b => b === 0)).toBe(true);
    // endpoints should also be snapped to round values
    // toBeCloseTo avoids Object.is(-0, 0) === false when JS % returns -0
    expect(breaks[0] % 10).toBeCloseTo(0);
    expect(breaks[breaks.length - 1] % 10).toBeCloseTo(0);
  });
});
