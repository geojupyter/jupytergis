import { IJGISLayer, IHeatmapLayer, IVectorLayer } from '@jupytergis/schema';

import { findExprNode, isColor, RgbaColor } from './colorRampUtils';
import { GeometryType } from './styleBuilder';

type VectorSymbologyState = NonNullable<IVectorLayer['symbologyState']>;
type StopRow = NonNullable<VectorSymbologyState['stops']>[number];
type RadiusStopRow = NonNullable<VectorSymbologyState['radiusStops']>[number];

/**
 * Migrate a layer in place if it still uses the legacy `parameters.color`
 * representation. Safe to call on already-migrated or non-vector layers: it
 * is a no-op when there is nothing to do.
 */
export function migrateLegacyLayerSymbology(
  layer: IJGISLayer | undefined,
): void {
  if (!layer?.parameters) {
    return;
  }

  if (layer.type === 'VectorLayer' || layer.type === 'VectorTileLayer') {
    migrateVector(layer.parameters as IVectorLayer);
    return;
  }

  if (layer.type === 'HeatmapLayer') {
    migrateHeatmap(layer.parameters as IHeatmapLayer);
    return;
  }
}

// Vector migration

function migrateVector(params: IVectorLayer): void {
  const legacyColor = params.color;
  // Nothing to migrate, or already migrated (stops present).
  if (
    !legacyColor ||
    typeof legacyColor !== 'object' ||
    Array.isArray(legacyColor)
  ) {
    if (legacyColor !== undefined) {
      delete params.color;
    }
    return;
  }

  const state: VectorSymbologyState =
    params.symbologyState ??
    ({ renderType: 'Single Symbol' } as VectorSymbologyState);

  // If stops is already populated, the layer is either new-format or was
  // previously migrated. Drop the legacy cache and move on.
  const alreadyMigrated =
    (state.stops && state.stops.length > 0) ||
    (state.radiusStops && state.radiusStops.length > 0) ||
    state.fillColor !== undefined ||
    state.strokeColor !== undefined;
  if (alreadyMigrated) {
    delete params.color;
    params.symbologyState = state;
    return;
  }

  // Geometry type: sniff from which OL style keys the legacy color used.
  state.geometryType ??= detectGeometry(legacyColor);

  // Manual stroke color / width / radius.
  const solidStroke = firstSolidColor(
    legacyColor['stroke-color'],
    legacyColor['circle-stroke-color'],
  );
  if (solidStroke && state.strokeColor === undefined) {
    state.strokeColor = solidStroke;
  }
  const sw = pickNumber(
    legacyColor['stroke-width'],
    legacyColor['circle-stroke-width'],
  );
  if (sw !== undefined && state.strokeWidth === undefined) {
    state.strokeWidth = sw;
  }
  const r = pickNumber(legacyColor['circle-radius']);
  if (r !== undefined && state.radius === undefined) {
    state.radius = r;
  }
  const joinStyle =
    legacyColor['stroke-line-join'] ?? legacyColor['circle-stroke-line-join'];
  if (typeof joinStyle === 'string' && state.joinStyle === undefined) {
    state.joinStyle = joinStyle as VectorSymbologyState['joinStyle'];
  }
  const capStyle =
    legacyColor['stroke-line-cap'] ?? legacyColor['circle-stroke-line-cap'];
  if (typeof capStyle === 'string' && state.capStyle === undefined) {
    state.capStyle = capStyle as VectorSymbologyState['capStyle'];
  }

  // Manual fill color: only if the fill is a plain color (not an expression).
  const solidFill = firstSolidColor(
    legacyColor['fill-color'],
    legacyColor['circle-fill-color'],
  );
  if (solidFill && state.fillColor === undefined) {
    state.fillColor = solidFill;
  }

  // Stops: reverse-parse the first fill-color / circle-fill-color expression.
  const stops = parseColorStops(legacyColor);
  if (stops.length > 0) {
    state.stops = stops;
  }

  // Radius stops: reverse-parse circle-radius if it is an expression.
  const radiusStops = parseRadiusStops(legacyColor['circle-radius']);
  if (radiusStops.length > 0) {
    state.radiusStops = radiusStops;
  }

  params.symbologyState = state;
  delete params.color;
}

function detectGeometry(color: Record<string, unknown>): GeometryType {
  if (
    color['circle-fill-color'] !== undefined ||
    color['circle-radius'] !== undefined
  ) {
    return 'circle';
  }
  if (color['fill-color'] !== undefined) {
    return 'fill';
  }
  return 'line';
}

function firstSolidColor(...candidates: unknown[]): RgbaColor | undefined {
  for (const candidate of candidates) {
    if (isColor(candidate)) {
      if (Array.isArray(candidate)) {
        const [r = 0, g = 0, b = 0, a = 1] = candidate as number[];
        return [r, g, b, a];
      }
      // Hex strings are left to the dialog layer to parse; migration is
      // best-effort and OL accepts hex strings in FlatStyles too, so only
      // migrate numeric arrays which are the common case.
    }
  }
  return undefined;
}

function pickNumber(...candidates: unknown[]): number | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function parseColorStops(color: Record<string, unknown>): StopRow[] {
  const candidates = [color['fill-color'], color['circle-fill-color']];
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    const interpolate = findExprNode(candidate, 'interpolate');
    if (interpolate) {
      // ['interpolate', ['linear'], ['get', field], v0, c0, v1, c1, ...]
      const rows: StopRow[] = [];
      for (let i = 3; i < interpolate.length; i += 2) {
        const value = interpolate[i];
        const rgba = interpolate[i + 1];
        if (
          (typeof value === 'number' ||
            typeof value === 'string' ||
            typeof value === 'boolean') &&
          Array.isArray(rgba) &&
          rgba.length === 4
        ) {
          rows.push({
            value,
            color: rgba as [number, number, number, number],
          });
        }
      }
      if (rows.length > 0) {
        return rows;
      }
    }

    const caseExpr = findExprNode(candidate, 'case');
    if (caseExpr) {
      // ['case', cond, c0, cond, c1, ..., fallback]
      const rows: StopRow[] = [];
      for (let i = 1; i < caseExpr.length - 1; i += 2) {
        const cond = caseExpr[i] as unknown[];
        const rgba = caseExpr[i + 1];
        // cond is typically ['==', ['get', field], value]
        const value = Array.isArray(cond) ? cond[2] : undefined;
        if (
          (typeof value === 'number' ||
            typeof value === 'string' ||
            typeof value === 'boolean') &&
          Array.isArray(rgba) &&
          rgba.length === 4
        ) {
          rows.push({
            value,
            color: rgba as [number, number, number, number],
          });
        }
      }
      if (rows.length > 0) {
        return rows;
      }
    }
  }
  return [];
}

function parseRadiusStops(circleRadius: unknown): RadiusStopRow[] {
  if (!Array.isArray(circleRadius) || circleRadius[0] !== 'interpolate') {
    return [];
  }
  const rows: RadiusStopRow[] = [];
  for (let i = 3; i < circleRadius.length; i += 2) {
    const value = circleRadius[i];
    const radius = circleRadius[i + 1];
    if (typeof value === 'number' && typeof radius === 'number') {
      rows.push({ value, radius });
    }
  }
  return rows;
}

// Heatmap migration

function migrateHeatmap(params: IHeatmapLayer): void {
  const legacyColor = params.color;
  if (!legacyColor) {
    return;
  }
  const state = params.symbologyState ?? { renderType: 'Heatmap' };
  if (Array.isArray(legacyColor) && state.gradient === undefined) {
    state.gradient = legacyColor;
  }
  params.symbologyState = state;
  delete params.color;
}
