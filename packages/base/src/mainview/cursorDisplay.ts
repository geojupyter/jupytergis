import proj4 from 'proj4';

import {
  getProj4Definition,
  normalizeCrsCode,
} from '@/src/features/metadata/utils/crs';
import { wrapToInterval } from '@/src/tools';

import { CursorCoordMode, ICursorDisplay, ICursorReadout } from './mapAdapter';

const CURSOR_COORD_MODE_STORAGE_KEY = 'jupytergis:cursor-coord-mode';

const CURSOR_COORD_MODES: ReadonlySet<CursorCoordMode> = new Set([
  'degrees',
  'meters',
  'projection',
]);

export function loadCursorCoordMode(): CursorCoordMode {
  const stored = window.localStorage.getItem(CURSOR_COORD_MODE_STORAGE_KEY);
  if (stored && CURSOR_COORD_MODES.has(stored as CursorCoordMode)) {
    return stored as CursorCoordMode;
  }

  return 'projection';
}

export function saveCursorCoordMode(mode: CursorCoordMode): void {
  try {
    window.localStorage.setItem(CURSOR_COORD_MODE_STORAGE_KEY, mode);
  } catch {
    // No quota, no problem.
  }
}

/**
 * Convert a view-CRS cursor readout into the active status-bar mode.
 *
 * Uses the proj4 to convert so both adapters can keep emitting view-CRS
 * only (MapLibre metres, OpenLayers whatever the view is)
 */
export function toCursorDisplay(
  readout: ICursorReadout | null,
  mode: CursorCoordMode,
  projectionCode: string | undefined,
): ICursorDisplay | null {
  if (!readout) {
    return null;
  }

  switch (mode) {
    case 'projection':
      return {
        mode: 'projection',
        x: readout.x,
        y: readout.y,
        unit: readout.unit,
      };
    case 'degrees': {
      const lonLat = toLonLat(readout, projectionCode);
      if (!lonLat) {
        return null;
      }

      return {
        mode: 'degrees',
        lon: wrapToInterval(lonLat[0], -180, 180),
        lat: lonLat[1],
      };
    }
    case 'meters': {
      const meters = toMeters(readout, projectionCode);
      if (!meters) {
        return null;
      }

      return { mode: 'meters', x: meters[0], y: meters[1] };
    }
  }
}

function toLonLat(
  readout: ICursorReadout,
  projectionCode: string | undefined,
): [number, number] | undefined {
  if (isAngularUnit(readout.unit)) {
    return [readout.x, readout.y];
  }

  return transformPoint(readout.x, readout.y, projectionCode, 'EPSG:4326');
}

function toMeters(
  readout: ICursorReadout,
  projectionCode: string | undefined,
): [number, number] | undefined {
  if (isMetersUnit(readout.unit)) {
    return [readout.x, readout.y];
  }

  return transformPoint(readout.x, readout.y, projectionCode, 'EPSG:3857');
}

function transformPoint(
  x: number,
  y: number,
  fromCode: string | undefined,
  toCode: string,
): [number, number] | undefined {
  const from = normalizeCrsCode(fromCode);
  const to = normalizeCrsCode(toCode);
  if (!from || !to) {
    return undefined;
  }

  if (from === to) {
    return [x, y];
  }

  // Registers the definition when proj-codes knows it.
  if (!getProj4Definition(from) && !proj4.defs(from)) {
    return undefined;
  }
  if (!getProj4Definition(to) && !proj4.defs(to)) {
    return undefined;
  }

  try {
    const [outX, outY] = proj4(from, to, [x, y]);
    if (!Number.isFinite(outX) || !Number.isFinite(outY)) {
      return undefined;
    }

    return [outX, outY];
  } catch {
    return undefined;
  }
}

function isAngularUnit(unit: string): boolean {
  return unit === 'degrees' || unit === 'deg';
}

function isMetersUnit(unit: string): boolean {
  return unit === 'm' || unit === 'meters' || unit === 'metres';
}
