import { IVectorLayer } from '@jupytergis/schema';
import colormap from 'colormap';
import { FlatStyle } from 'ol/style/flat';

import { VectorClassifications } from './classificationModes';
import {
  colorToRgba,
  DEFAULT_STROKE_WIDTH,
  getColorMapList,
  IColorMap,
  RgbaColor,
} from './colorRampUtils';

export { DEFAULT_STROKE_WIDTH };

export type SymbologyState = NonNullable<IVectorLayer['symbologyState']>;
export type GeometryType = 'fill' | 'circle' | 'line';

/** Default OL flat style used when no Grammar rules produce output. */
export const DEFAULT_FLAT_STYLE: FlatStyle = {
  'fill-color': 'rgba(255,255,255,0.4)',
  'stroke-color': '#3399CC',
  'stroke-width': 1.25,
  'circle-radius': 5,
  'circle-fill-color': 'rgba(255,255,255,0.4)',
  'circle-stroke-width': 1.25,
  'circle-stroke-color': '#3399CC',
};

/** Sentinel stop values for missing data. */
export const STOP_NULL = '__null__';
export const STOP_UNDEFINED = '__undefined__';

/** A computed stop: value → RGBA color. */
export interface IComputedStop {
  value: number | string | boolean;
  color: RgbaColor;
}

// Stop computation helpers — used by the Grammar compiler

/**
 * Compute color stops for Graduated symbology from the config + feature values.
 */
export function computeGraduatedColorStops(
  state: SymbologyState,
  numericValues: number[],
): IComputedStop[] {
  const nClasses = state.nClasses ?? 9;
  const nStops = nClasses + 1; // classification functions use anchor-point count
  const mode = state.mode ?? 'equal interval';
  const rampName = state.colorRamp ?? 'viridis';
  const reverse = state.reverseRamp ?? false;

  const parsedVmin = state.vmin !== undefined ? state.vmin : undefined;
  const parsedVmax = state.vmax !== undefined ? state.vmax : undefined;

  const values = numericValues.filter(v => {
    if (parsedVmin !== undefined && v < parsedVmin) {
      return false;
    }
    if (parsedVmax !== undefined && v > parsedVmax) {
      return false;
    }
    return true;
  });

  // If no feature values are in range but vmin/vmax are explicitly set (e.g.
  // for VectorTile sources where getFeatures() is unavailable), use them as a
  // synthetic range so stops can still be computed.
  const effectiveValues =
    values.length > 0
      ? values
      : parsedVmin !== undefined && parsedVmax !== undefined
        ? [parsedVmin, parsedVmax]
        : [];

  if (effectiveValues.length === 0) {
    return [];
  }

  const dataMin = Math.min(...effectiveValues);
  const dataMax = Math.max(...effectiveValues);
  const rangeMin = parsedVmin ?? dataMin;
  const rangeMax = parsedVmax ?? dataMax;
  const rangeValues = [rangeMin, rangeMax];

  let stops: number[];
  switch (mode) {
    case 'quantile':
      stops = VectorClassifications.calculateQuantileBreaks(
        effectiveValues,
        nStops,
      );
      break;
    case 'equal interval':
      stops = VectorClassifications.calculateEqualIntervalBreaks(
        rangeValues,
        nStops,
      );
      break;
    case 'jenks':
      stops = VectorClassifications.calculateJenksBreaks(
        effectiveValues,
        nStops,
      );
      break;
    case 'pretty':
      stops = VectorClassifications.calculatePrettyBreaks(rangeValues, nStops);
      break;
    case 'logarithmic':
      stops = VectorClassifications.calculateLogarithmicBreaks(
        rangeValues,
        nStops,
      );
      break;
    default:
      stops = VectorClassifications.calculateEqualIntervalBreaks(
        rangeValues,
        nStops,
      );
  }

  return mapStopsToColors(stops, rampName, stops.length, reverse);
}

/**
 * Compute color stops for Categorized symbology from the config + feature values.
 */
export function computeCategorizedColorStops(
  state: SymbologyState,
  featureValues: unknown[],
): IComputedStop[] {
  const rampName = state.colorRamp ?? 'viridis';
  const reverse = state.reverseRamp ?? false;

  const uniqueValues = [
    ...new Set(
      featureValues.map(v =>
        v === null ? STOP_NULL : v === undefined ? STOP_UNDEFINED : v,
      ),
    ),
  ].sort((a: any, b: any) => {
    const aIsSentinel = a === STOP_NULL || a === STOP_UNDEFINED;
    const bIsSentinel = b === STOP_NULL || b === STOP_UNDEFINED;
    if (aIsSentinel && !bIsSentinel) {
      return 1;
    }
    if (!aIsSentinel && bIsSentinel) {
      return -1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });

  if (uniqueValues.length === 0) {
    return [];
  }

  const colorRamp = getColorMapList().find(c => c.name === rampName);
  if (!colorRamp) {
    return [];
  }

  const colors = generateColors(colorRamp, uniqueValues.length, reverse);

  return uniqueValues.map((v, i) => ({
    value: v as number | string | boolean,
    color: colors[i],
  }));
}

// Color ramp helpers

function mapStopsToColors(
  stops: number[],
  rampName: string,
  nClasses: number,
  reverse: boolean,
): IComputedStop[] {
  const colorRamp = getColorMapList().find(c => c.name === rampName);
  if (!colorRamp) {
    return [];
  }

  const colors = generateColors(colorRamp, nClasses, reverse);

  return stops.map((v, i) => ({
    value: v,
    color: colors[Math.min(i, colors.length - 1)],
  }));
}

function generateColors(
  colorRamp: IColorMap,
  nClasses: number,
  reverse: boolean,
): RgbaColor[] {
  let colorMap: RgbaColor[];

  if (colorRamp.type === 'categorical') {
    let rawColors = [...colorRamp.colors] as any[];
    if (rawColors.length < nClasses) {
      rawColors = Array.from(
        { length: nClasses },
        (_, i) => rawColors[i % rawColors.length],
      );
    } else {
      rawColors = rawColors.slice(0, nClasses);
    }
    // Parse categorical colors to RGBA.  D3 categorical schemes produce hex
    // strings (#rrggbb); continuous colormaps produce rgb() strings.
    // colorToRgba handles both formats.
    colorMap = rawColors.map(c =>
      typeof c === 'string' ? colorToRgba(c) : (c as RgbaColor),
    );
  } else {
    const nShades = Math.max(nClasses, 9);
    colorMap = colormap({
      colormap: colorRamp.name,
      nshades: nShades,
      format: 'rgba',
    }) as unknown as RgbaColor[];
  }

  if (reverse) {
    colorMap = [...colorMap].reverse();
  }

  // Sample nClasses colors evenly from the map.
  const result: RgbaColor[] = [];
  for (let i = 0; i < nClasses; i++) {
    const idx =
      colorRamp.type === 'categorical'
        ? i
        : Math.round((i / (nClasses - 1)) * (colorMap.length - 1));
    result.push(colorMap[idx]);
  }

  return result;
}
