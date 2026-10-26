/**
 * @jest-environment jsdom
 */

import {
  loadCursorCoordMode,
  saveCursorCoordMode,
  toCursorDisplay,
} from '../cursorDisplay';
import type { ICursorReadout } from '../mapAdapter';
import { wrapToInterval } from '../utils/wrapToInterval';

const NYC_LON_LAT: ICursorReadout = {
  x: -74.006,
  y: 40.7128,
  unit: 'degrees',
};

/** Rough Web Mercator metres for NYC (EPSG:3857). */
const NYC_METERS: ICursorReadout = {
  x: -8238310.24,
  y: 4970071.58,
  unit: 'm',
};

describe('wrapToInterval', () => {
  it('leaves values inside the open/closed range alone', () => {
    expect(wrapToInterval(0, -180, 180)).toBe(0);
    expect(wrapToInterval(179, -180, 180)).toBe(179);
    expect(wrapToInterval(180, -180, 180)).toBe(180);
  });

  it('wraps longitudes past the antimeridian into (-180, 180]', () => {
    expect(wrapToInterval(181, -180, 180)).toBe(-179);
    expect(wrapToInterval(540, -180, 180)).toBe(180);
    expect(wrapToInterval(-181, -180, 180)).toBe(179);
  });

  it('maps the min endpoint to max (MapLibre-style)', () => {
    expect(wrapToInterval(-180, -180, 180)).toBe(180);
  });
});

describe('toCursorDisplay', () => {
  it('returns null when the pointer is off the map', () => {
    expect(toCursorDisplay(null, 'projection', 'EPSG:3857')).toBeNull();
    expect(toCursorDisplay(null, 'degrees', 'EPSG:3857')).toBeNull();
    expect(toCursorDisplay(null, 'meters', 'EPSG:3857')).toBeNull();
  });

  it('passes projection mode through unchanged', () => {
    expect(toCursorDisplay(NYC_METERS, 'projection', 'EPSG:3857')).toEqual({
      mode: 'projection',
      x: NYC_METERS.x,
      y: NYC_METERS.y,
      unit: 'm',
    });
  });

  it('passes metres through when the view unit is already metres', () => {
    expect(toCursorDisplay(NYC_METERS, 'meters', 'EPSG:3857')).toEqual({
      mode: 'meters',
      x: NYC_METERS.x,
      y: NYC_METERS.y,
    });
  });

  it('converts geographic readout to metres', () => {
    const result = toCursorDisplay(NYC_LON_LAT, 'meters', 'EPSG:4326');
    expect(result?.mode).toBe('meters');
    expect(result && 'x' in result ? result.x : undefined).toBeCloseTo(
      NYC_METERS.x,
      0,
    );
    expect(result && 'y' in result ? result.y : undefined).toBeCloseTo(
      NYC_METERS.y,
      0,
    );
  });

  it('passes degrees through when the view unit is already angular', () => {
    const result = toCursorDisplay(NYC_LON_LAT, 'degrees', 'EPSG:4326');
    expect(result?.mode).toBe('degrees');
    expect(result && 'lon' in result ? result.lon : undefined).toBeCloseTo(
      NYC_LON_LAT.x,
      5,
    );
    expect(result && 'lat' in result ? result.lat : undefined).toBeCloseTo(
      NYC_LON_LAT.y,
      5,
    );
  });

  it('wraps longitude in degrees mode', () => {
    const readout: ICursorReadout = {
      x: 190,
      y: 10,
      unit: 'degrees',
    };
    expect(toCursorDisplay(readout, 'degrees', 'EPSG:4326')).toEqual({
      mode: 'degrees',
      lon: -170,
      lat: 10,
    });
  });

  it('converts metres readout to degrees', () => {
    const result = toCursorDisplay(NYC_METERS, 'degrees', 'EPSG:3857');
    expect(result?.mode).toBe('degrees');
    expect(result && 'lon' in result ? result.lon : undefined).toBeCloseTo(
      NYC_LON_LAT.x,
      2,
    );
    expect(result && 'lat' in result ? result.lat : undefined).toBeCloseTo(
      NYC_LON_LAT.y,
      2,
    );
  });

  it('returns null for convert modes when the CRS is unknown', () => {
    expect(toCursorDisplay(NYC_METERS, 'degrees', 'EPSG:999999')).toBeNull();
    expect(toCursorDisplay(NYC_LON_LAT, 'meters', 'EPSG:999999')).toBeNull();
  });

  it('converts radian view units to degrees', () => {
    const readout: ICursorReadout = {
      x: (-74.006 * Math.PI) / 180,
      y: (40.7128 * Math.PI) / 180,
      unit: 'radians',
    };
    const result = toCursorDisplay(readout, 'degrees', 'EPSG:4326');
    expect(result?.mode).toBe('degrees');
    expect(result && 'lon' in result ? result.lon : undefined).toBeCloseTo(
      -74.006,
      5,
    );
    expect(result && 'lat' in result ? result.lat : undefined).toBeCloseTo(
      40.7128,
      5,
    );
  });
});

describe('loadCursorCoordMode / saveCursorCoordMode', () => {
  const key = 'jupytergis:cursor-coord-mode';

  beforeEach(() => {
    window.localStorage.removeItem(key);
  });

  it('defaults to projection when nothing is stored', () => {
    expect(loadCursorCoordMode()).toBe('projection');
  });

  it('round-trips a saved mode', () => {
    saveCursorCoordMode('degrees');
    expect(loadCursorCoordMode()).toBe('degrees');
    saveCursorCoordMode('meters');
    expect(loadCursorCoordMode()).toBe('meters');
  });

  it('ignores an invalid stored value', () => {
    window.localStorage.setItem(key, 'furlongs');
    expect(loadCursorCoordMode()).toBe('projection');
  });
});
