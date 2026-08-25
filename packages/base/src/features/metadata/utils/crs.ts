import proj4 from 'proj4';
import proj4list from 'proj4-list';

import { ICrsMetadata } from '../types';

/**
 * Names for the handful of CRSs that show up constantly in web mapping.
 *
 * `proj4-list` ships proj4 strings but no human readable names, and we
 * deliberately do not bundle an EPSG database just to label a projection. For
 * anything outside this list the name is left undefined unless the file itself
 * carries one (e.g. a GeoTIFF citation key).
 */
const WELL_KNOWN_CRS_NAMES: Record<string, string> = {
  'EPSG:4326': 'WGS 84',
  'EPSG:3857': 'WGS 84 / Pseudo-Mercator',
  'EPSG:4269': 'NAD83',
  'EPSG:3395': 'WGS 84 / World Mercator',
  'EPSG:4258': 'ETRS89',
  'OGC:CRS84': 'WGS 84 (longitude/latitude order)',
};

/**
 * Number of points sampled along each edge when reprojecting an extent.
 *
 * Transforming only the four corners is wrong for most projections, since the
 * edges of a projected box are generally curved in the target CRS. Sampling
 * along the edges and taking the envelope of the results is accurate enough to
 * report a bounding box to a human.
 */
const EXTENT_DENSIFY_STEPS = 8;

/**
 * Normalize the many ways a CRS code shows up into `AUTHORITY:CODE` form.
 *
 * Handles bare numbers (`26915`), the usual prefixed form (`epsg:26915`) and
 * OGC URNs (`urn:ogc:def:crs:EPSG::26915`).
 */
export function normalizeCrsCode(
  code?: string | number | null,
): string | undefined {
  if (code === undefined || code === null || code === '') {
    return undefined;
  }

  if (typeof code === 'number') {
    return Number.isFinite(code) ? `EPSG:${code}` : undefined;
  }

  const trimmed = code.trim();
  if (!trimmed) {
    return undefined;
  }

  // urn:ogc:def:crs:EPSG::26915 / urn:ogc:def:crs:OGC:1.3:CRS84
  const urnMatch = trimmed.match(/^urn:ogc:def:crs:([^:]+):[^:]*:(.+)$/i);
  if (urnMatch) {
    return `${urnMatch[1].toUpperCase()}:${urnMatch[2]}`;
  }

  if (/^\d+$/.test(trimmed)) {
    return `EPSG:${trimmed}`;
  }

  const prefixed = trimmed.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
  if (prefixed) {
    return `${prefixed[1].toUpperCase()}:${prefixed[2]}`;
  }

  return trimmed;
}

/**
 * Return the proj4 definition string for a CRS code, registering it with proj4
 * on the way if it is known to `proj4-list` but not yet defined.
 */
export function getProj4Definition(code?: string): string | undefined {
  const normalized = normalizeCrsCode(code);
  if (!normalized) {
    return undefined;
  }

  const listed = proj4list[normalized];
  if (!listed) {
    return undefined;
  }

  const definition = (Array.isArray(listed) ? listed[1] : listed).trim();

  // Registering here means a code we can describe is also a code we can
  // transform with, without every caller having to remember to do this.
  if (!proj4.defs(normalized)) {
    proj4.defs(normalized, definition);
  }

  return definition;
}

/**
 * Make sure proj4 knows about a code, so that it can be used in a transform.
 */
function ensureProj4Definition(code: string): boolean {
  if (proj4.defs(code)) {
    return true;
  }
  return getProj4Definition(code) !== undefined;
}

/**
 * A human readable name for a CRS code, when we can supply one without
 * guessing.
 */
export function getWellKnownCrsName(code?: string): string | undefined {
  const normalized = normalizeCrsCode(code);
  return normalized ? WELL_KNOWN_CRS_NAMES[normalized] : undefined;
}

/**
 * Extract the unit of measure from a proj4 definition string.
 */
export function getCrsUnits(proj4Definition?: string): string | undefined {
  if (!proj4Definition) {
    return undefined;
  }

  const units = proj4Definition.match(/\+units=([^\s]+)/);
  if (units) {
    return units[1];
  }

  // Geographic CRSs carry no +units; their coordinates are angular.
  if (/\+proj=longlat\b/.test(proj4Definition)) {
    return 'degrees';
  }

  return undefined;
}

/**
 * A link to a page explaining the CRS in question.
 *
 * epsg.io covers EPSG codes; anything else gets no link rather than a broken
 * one.
 */
export function getCrsInfoUrl(code?: string): string | undefined {
  const normalized = normalizeCrsCode(code);
  if (!normalized) {
    return undefined;
  }

  const epsg = normalized.match(/^EPSG:(\d+)$/);
  return epsg ? `https://epsg.io/${epsg[1]}` : undefined;
}

/**
 * Build the CRS section from whatever the format told us.
 *
 * `name` and `wkt` are only ever what the file itself carries; the proj4 string
 * and units are looked up from the code.
 */
export function buildCrsMetadata(options: {
  code?: string | number | null;
  name?: string;
  wkt?: string;
}): ICrsMetadata | undefined {
  const code = normalizeCrsCode(options.code);
  const proj4String = getProj4Definition(code);
  const name = options.name?.trim() || getWellKnownCrsName(code);

  if (!code && !name && !options.wkt && !proj4String) {
    return undefined;
  }

  return {
    code,
    name,
    proj4: proj4String,
    wkt: options.wkt?.trim() || undefined,
    units: getCrsUnits(proj4String),
  };
}

/**
 * Reproject an extent, densifying its edges so that the result is a true
 * envelope of the source box rather than the envelope of its four corners.
 *
 * Returns `undefined` when either CRS is unknown to proj4 or the transform
 * fails, so that callers can simply omit the reprojected extent.
 */
export function transformExtent(
  extent: number[],
  from?: string,
  to = 'EPSG:4326',
): number[] | undefined {
  const fromCode = normalizeCrsCode(from);
  const toCode = normalizeCrsCode(to);

  if (!fromCode || !toCode || extent.length < 4) {
    return undefined;
  }

  if (fromCode === toCode) {
    return [...extent];
  }

  if (!ensureProj4Definition(fromCode) || !ensureProj4Definition(toCode)) {
    return undefined;
  }

  const [minX, minY, maxX, maxY] = extent;
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return undefined;
  }

  const points: [number, number][] = [];
  for (let i = 0; i <= EXTENT_DENSIFY_STEPS; i++) {
    const ratio = i / EXTENT_DENSIFY_STEPS;
    const x = minX + (maxX - minX) * ratio;
    const y = minY + (maxY - minY) * ratio;

    points.push([x, minY], [x, maxY], [minX, y], [maxX, y]);
  }

  try {
    const transformer = proj4(fromCode, toCode);
    const transformed = points
      .map(point => transformer.forward(point))
      .filter(point => point.every(Number.isFinite));

    if (!transformed.length) {
      return undefined;
    }

    return [
      Math.min(...transformed.map(p => p[0])),
      Math.min(...transformed.map(p => p[1])),
      Math.max(...transformed.map(p => p[0])),
      Math.max(...transformed.map(p => p[1])),
    ];
  } catch {
    return undefined;
  }
}
