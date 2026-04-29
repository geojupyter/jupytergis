import { IVectorLayer } from '@jupytergis/schema';
import colormap from 'colormap';
import { ExpressionValue } from 'ol/expr/expression';
import { FlatStyle } from 'ol/style/flat';

import { VectorClassifications } from './classificationModes';
import {
  DEFAULT_COLOR,
  DEFAULT_STROKE_WIDTH,
  getColorMapList,
  IColorMap,
  RgbaColor,
} from './colorRampUtils';

export type SymbologyState = NonNullable<IVectorLayer['symbologyState']>;
export type GeometryType = 'fill' | 'circle' | 'line';

const DEFAULT_RADIUS = 5;
const TRANSPARENT: RgbaColor = [0, 0, 0, 0];
const DEFAULT_FILL_COLOR: RgbaColor = [255, 255, 255, 0.4];

/**
 * Defaults applied when `buildVectorFlatStyle` returns `undefined`.
 */
export const DEFAULT_FLAT_STYLE: FlatStyle = {
  'fill-color': 'rgba(255,255,255,0.4)',
  'stroke-color': '#3399CC',
  'stroke-width': 1.25,
  'circle-radius': 5,
  'circle-fill-color': 'rgba(255,255,255,0.4)',
  'circle-stroke-width': 1.25,
  'circle-stroke-color': '#3399CC',
};

/** A computed stop: value → RGBA color. */
export interface IComputedStop {
  value: number | string | boolean;
  color: RgbaColor;
}

/** A computed radius stop: value → radius. */
export interface IComputedRadiusStop {
  value: number;
  radius: number;
}

// Public API

/**
 * Build an OpenLayers FlatStyle for a vector layer from its symbologyState,
 * computing classification stops on the fly from the provided feature values.
 *
 * @param state      The persisted symbologyState (minimal config).
 * @param featureValues  All values for `state.value` extracted from source features.
 *                       For Graduated, should be numbers. For Categorized, any primitive.
 *                       Pass an empty array if the source hasn't loaded yet.
 */
export function buildVectorFlatStyle(
  state: SymbologyState | undefined,
  featureValues: unknown[],
): FlatStyle | undefined {
  if (!state?.renderType) {
    return undefined;
  }

  switch (state.renderType) {
    case 'Single Symbol':
      return buildSingleSymbol(state);
    case 'Graduated':
      return buildGraduated(state, featureValues);
    case 'Categorized':
      return buildCategorized(state, featureValues);
    case 'Canonical':
      return buildCanonical(state);
    default:
      return undefined;
  }
}

/**
 * When `symbologyState.fallbackColor` has alpha 0, features that would be
 * drawn with the fallback color are excluded from rendering via an OL filter.
 */
export function buildTransparentFallbackFilter(
  state: SymbologyState | undefined,
  featureValues: unknown[],
): ExpressionValue | undefined {
  if (
    !state ||
    !Array.isArray(state.fallbackColor) ||
    state.fallbackColor[3] !== 0
  ) {
    return undefined;
  }
  const field = state.value;
  if (!field) {
    return undefined;
  }

  switch (state.renderType) {
    case 'Graduated':
    case 'Canonical':
      return ['has', field];

    case 'Categorized': {
      // For categorized, only show features whose value is in the stop list.
      // Prefer stopsOverride (persisted by the dialog for all source types),
      // fall back to featureValues for in-memory VectorSource layers.
      let uniqueValues: unknown[];
      if (state.stopsOverride && state.stopsOverride.length > 0) {
        uniqueValues = state.stopsOverride
          .map(s => s.value)
          .filter(v => v !== undefined && v !== null);
      } else {
        uniqueValues = [
          ...new Set(featureValues.filter(v => v !== undefined && v !== null)),
        ];
      }
      if (uniqueValues.length === 0) {
        return ['==', 0, 1];
      }
      const conditions: ExpressionValue[] = uniqueValues.map(v => [
        '==',
        ['get', field],
        v as ExpressionValue,
      ]);
      return conditions.length === 1 ? conditions[0] : ['any', ...conditions];
    }

    default:
      return undefined;
  }
}

// Helpers

/**
 * Convert persisted `stopsOverride` to `IComputedStop[]`, or return
 * `undefined` if no override is present so callers fall through to
 * the computed path.
 *
 * @param numericValues  When true, coerce stop values to numbers (Graduated).
 *                       When false, keep them as-is (Categorized).
 */
function overrideToComputedStops(
  overrides: SymbologyState['stopsOverride'],
  numericValues = false,
): IComputedStop[] | undefined {
  if (!overrides || overrides.length === 0) {
    return undefined;
  }
  const valid = overrides.filter(
    s => s.value !== undefined && s.color !== undefined,
  );
  if (valid.length === 0) {
    return undefined;
  }
  return valid.map(s => {
    const raw = s.value;
    const value = numericValues
      ? typeof raw === 'string'
        ? parseFloat(raw)
        : (raw as number)
      : (raw as number | string | boolean);
    return { value, color: s.color as RgbaColor };
  });
}

// Stop computation from symbologyState + feature data

/**
 * Compute color stops for Graduated symbology from the config + feature values.
 */
function computeGraduatedColorStops(
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
function computeCategorizedColorStops(
  state: SymbologyState,
  featureValues: unknown[],
): IComputedStop[] {
  const rampName = state.colorRamp ?? 'viridis';
  const reverse = state.reverseRamp ?? false;

  const uniqueValues = [
    ...new Set(featureValues.filter(v => v !== undefined && v !== null)),
  ].sort((a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0));

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

/**
 * Compute radius stops for Graduated (method='radius') from feature values.
 */
function computeGraduatedRadiusStops(
  state: SymbologyState,
  numericValues: number[],
): IComputedRadiusStop[] {
  const nClasses = state.nClasses ?? 9;
  const mode = state.mode ?? 'equal interval';

  const parsedVmin = state.vmin;
  const parsedVmax = state.vmax;
  const values = numericValues.filter(v => {
    if (parsedVmin !== undefined && v < parsedVmin) {
      return false;
    }
    if (parsedVmax !== undefined && v > parsedVmax) {
      return false;
    }
    return true;
  });
  if (values.length === 0) {
    return [];
  }

  const rangeMin = parsedVmin ?? Math.min(...values);
  const rangeMax = parsedVmax ?? Math.max(...values);
  const rangeValues = [rangeMin, rangeMax];

  let stops: number[];
  switch (mode) {
    case 'quantile':
      stops = VectorClassifications.calculateQuantileBreaks(values, nClasses);
      break;
    case 'equal interval':
      stops = VectorClassifications.calculateEqualIntervalBreaks(
        rangeValues,
        nClasses,
      );
      break;
    case 'jenks':
      stops = VectorClassifications.calculateJenksBreaks(values, nClasses);
      break;
    case 'pretty':
      stops = VectorClassifications.calculatePrettyBreaks(
        rangeValues,
        nClasses,
      );
      break;
    case 'logarithmic':
      stops = VectorClassifications.calculateLogarithmicBreaks(
        rangeValues,
        nClasses,
      );
      break;
    default:
      stops = VectorClassifications.calculateEqualIntervalBreaks(
        rangeValues,
        nClasses,
      );
  }

  if (stops.length > 0) {
    stops[0] = rangeMin;
    stops[stops.length - 1] = rangeMax;
  }

  // Map stops linearly to radius values (stop value = radius).
  return stops.map(v => ({ value: v, radius: v }));
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
    // Parse categorical colors (they're CSS strings like "rgb(...)") to RGBA.
    colorMap = rawColors.map(c => {
      if (typeof c === 'string') {
        const match = c.match(
          /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
        );
        if (match) {
          return [
            +match[1],
            +match[2],
            +match[3],
            match[4] !== undefined ? +match[4] : 1,
          ] as RgbaColor;
        }
        return DEFAULT_COLOR;
      }
      return c as RgbaColor;
    });
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

// Per-render-type builders

function buildSingleSymbol(state: SymbologyState): FlatStyle {
  const fill = (state.fillColor ?? DEFAULT_FILL_COLOR) as number[];
  const stroke = (state.strokeColor ?? DEFAULT_COLOR) as number[];
  const strokeWidth = nonNegative(state.strokeWidth, DEFAULT_STROKE_WIDTH);
  const radius = state.radius ?? DEFAULT_RADIUS;
  const joinStyle = state.joinStyle ?? 'round';
  const capStyle = state.capStyle ?? 'round';

  return {
    'fill-color': fill,
    'stroke-color': stroke,
    'stroke-width': strokeWidth,
    'stroke-line-join': joinStyle,
    'stroke-line-cap': capStyle,
    'circle-radius': radius,
    'circle-fill-color': fill,
    'circle-stroke-color': stroke,
    'circle-stroke-width': strokeWidth,
    'circle-stroke-line-join': joinStyle,
    'circle-stroke-line-cap': capStyle,
  };
}

function buildGraduated(
  state: SymbologyState,
  featureValues: unknown[],
): FlatStyle {
  const field = state.value;
  const fallback = (state.fallbackColor ?? TRANSPARENT) as number[];
  const strokeWidth = nonNegative(state.strokeWidth, DEFAULT_STROKE_WIDTH);
  const baseRadius = state.radius ?? DEFAULT_RADIUS;
  const manualStroke = (state.strokeColor ?? DEFAULT_COLOR) as number[];
  const style: FlatStyle = {
    'stroke-width': strokeWidth,
    'circle-stroke-width': strokeWidth,
  };

  const numericValues = featureValues.filter(Number.isFinite) as number[];

  // Color stops (method='color' or unset)
  if (field && state.method !== 'radius') {
    const colorStops =
      overrideToComputedStops(state.stopsOverride, true) ??
      computeGraduatedColorStops(state, numericValues);
    if (colorStops.length > 0) {
      const interpolate: ExpressionValue[] = [
        'interpolate',
        ['linear'],
        ['get', field],
      ];
      for (const stop of colorStops) {
        interpolate.push(stop.value as ExpressionValue);
        interpolate.push(stop.color as ExpressionValue);
      }
      const colorExpr: ExpressionValue = [
        'case',
        ['has', field],
        interpolate,
        fallback as ExpressionValue,
      ];
      style['fill-color'] = colorExpr;
      style['circle-fill-color'] = colorExpr;

      if (state.strokeFollowsFill) {
        style['stroke-color'] = colorExpr;
        style['circle-stroke-color'] = colorExpr;
      } else {
        style['stroke-color'] = manualStroke;
        style['circle-stroke-color'] = manualStroke;
      }
    } else {
      style['fill-color'] = (state.fillColor ?? DEFAULT_FILL_COLOR) as number[];
      style['circle-fill-color'] = (state.fillColor ??
        DEFAULT_FILL_COLOR) as number[];
      style['stroke-color'] = manualStroke;
      style['circle-stroke-color'] = manualStroke;
    }
  } else {
    style['fill-color'] = (state.fillColor ?? DEFAULT_FILL_COLOR) as number[];
    style['circle-fill-color'] = (state.fillColor ??
      DEFAULT_FILL_COLOR) as number[];
    style['stroke-color'] = manualStroke;
    style['circle-stroke-color'] = manualStroke;
  }

  // Radius stops (method='radius')
  if (field && state.method === 'radius') {
    const radiusStops = computeGraduatedRadiusStops(state, numericValues);
    if (radiusStops.length > 0) {
      const radiusExpr: ExpressionValue[] = [
        'interpolate',
        ['linear'],
        ['get', field],
      ];
      for (const stop of radiusStops) {
        radiusExpr.push(stop.value);
        radiusExpr.push(stop.radius);
      }
      style['circle-radius'] = radiusExpr;
    } else {
      style['circle-radius'] = baseRadius;
    }
  } else {
    style['circle-radius'] = baseRadius;
  }

  return style;
}

function buildCategorized(
  state: SymbologyState,
  featureValues: unknown[],
): FlatStyle {
  const field = state.value;
  const fallback = (state.fallbackColor ?? TRANSPARENT) as number[];
  const strokeWidth = nonNegative(state.strokeWidth, DEFAULT_STROKE_WIDTH);
  const radius = state.radius ?? DEFAULT_RADIUS;
  const manualFill = (state.fillColor ?? DEFAULT_FILL_COLOR) as number[];
  const manualStroke = (state.strokeColor ?? DEFAULT_COLOR) as number[];

  const style: FlatStyle = {
    'stroke-width': strokeWidth,
    'circle-stroke-width': strokeWidth,
    'circle-radius': radius,
  };

  if (field) {
    const stops =
      overrideToComputedStops(state.stopsOverride) ??
      computeCategorizedColorStops(state, featureValues);
    if (stops.length > 0) {
      const caseExpr: ExpressionValue[] = ['case'];
      for (const stop of stops) {
        caseExpr.push(['==', ['get', field], stop.value as ExpressionValue]);
        caseExpr.push(stop.color as ExpressionValue);
      }
      caseExpr.push(fallback as ExpressionValue);

      style['fill-color'] = caseExpr;
      style['circle-fill-color'] = caseExpr;

      if (state.strokeFollowsFill) {
        style['stroke-color'] = caseExpr;
        style['circle-stroke-color'] = caseExpr;
      } else {
        style['stroke-color'] = manualStroke;
        style['circle-stroke-color'] = manualStroke;
      }
    } else {
      style['fill-color'] = manualFill;
      style['circle-fill-color'] = manualFill;
      style['stroke-color'] = manualStroke;
      style['circle-stroke-color'] = manualStroke;
    }
  } else {
    style['fill-color'] = manualFill;
    style['circle-fill-color'] = manualFill;
    style['stroke-color'] = manualStroke;
    style['circle-stroke-color'] = manualStroke;
  }

  return style;
}

function buildCanonical(state: SymbologyState): FlatStyle {
  const field = state.value;
  const fallback = (state.fallbackColor ?? TRANSPARENT) as number[];
  const strokeWidth = nonNegative(state.strokeWidth, DEFAULT_STROKE_WIDTH);
  const manualStroke = (state.strokeColor ?? DEFAULT_COLOR) as number[];

  if (!field) {
    return buildSingleSymbol(state);
  }

  const colorExpr: ExpressionValue = [
    'coalesce',
    ['get', field],
    fallback as ExpressionValue,
  ];

  const style: FlatStyle = {
    'fill-color': colorExpr,
    'circle-fill-color': colorExpr,
    'stroke-width': strokeWidth,
    'circle-stroke-width': strokeWidth,
    'circle-radius': state.radius ?? DEFAULT_RADIUS,
  };

  if (state.strokeFollowsFill ?? true) {
    style['stroke-color'] = colorExpr;
    style['circle-stroke-color'] = colorExpr;
  } else {
    style['stroke-color'] = manualStroke;
    style['circle-stroke-color'] = manualStroke;
  }
  return style;
}

function nonNegative(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, value);
}
