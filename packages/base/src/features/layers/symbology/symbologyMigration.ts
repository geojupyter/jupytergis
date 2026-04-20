import { IJGISLayer, IHeatmapLayer, IVectorLayer } from '@jupytergis/schema';

import { isColor, RgbaColor } from './colorRampUtils';
import { GeometryType } from './styleBuilder';

type VectorSymbologyState = NonNullable<IVectorLayer['symbologyState']>;

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
  // Nothing to migrate if legacy color is absent or not an object.
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

  // If config fields are already populated, the layer is either new-format or
  // was previously migrated. Drop the legacy cache and move on.
  const alreadyMigrated =
    state.fillColor !== undefined || state.strokeColor !== undefined;
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
