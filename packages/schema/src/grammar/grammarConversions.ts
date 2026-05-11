/**
 * Conversions between existing symbology render types and IGrammarSymbologyState.
 *
 * Pure schema transforms with no OL or UI dependencies, usable both as a
 * schema migration step and when the user switches render types in the dialog.
 */

import { UUID } from '@lumino/coreutils';

import {
  ClassificationMode,
  IEncodingRule,
  IGrammarSymbologyState,
  IMapping,
  RGBA,
} from './types';

/**
 * Legacy symbology state shape — as it existed before Grammar became the sole
 * render type. Used only by migration code that converts old .jGIS files.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export type SymbologyState = {
  renderType: string;
  value?: string;
  fillColor?: RGBA | number[];
  strokeColor?: RGBA | number[];
  strokeWidth?: number;
  radius?: number;
  joinStyle?: string;
  capStyle?: string;
  colorRamp?: string;
  nClasses?: number;
  reverseRamp?: boolean;
  mode?: ClassificationMode;
  fallbackColor?: RGBA | number[];
  strokeFollowsFill?: boolean;
  vmin?: number;
  vmax?: number;
  stopsOverride?: Array<{ value?: unknown; color?: unknown }>;
  gradient?: string[];
  blur?: number;
  [key: string]: unknown;
};

const DEFAULT_STROKE_WIDTH = 1.25;
const DEFAULT_FILL: RGBA = [255, 255, 255, 0.4];
const DEFAULT_STROKE: RGBA = [51, 153, 204, 1];
const DEFAULT_RADIUS = 5;
const TRANSPARENT: RGBA = [0, 0, 0, 0];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Wrap a list of rules in a single default IGrammarLayer. */
function wrapLayer(rules: IEncodingRule[]): IGrammarSymbologyState['layers'] {
  return [{ id: UUID.uuid4(), rules }];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Convert a Single Symbol state to Grammar. */
export function singleSymbolToGrammar(
  state: SymbologyState,
): IGrammarSymbologyState {
  const fill = (state.fillColor ?? DEFAULT_FILL) as RGBA;
  const stroke = (state.strokeColor ?? DEFAULT_STROKE) as RGBA;
  const strokeWidth = state.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const radius = state.radius ?? DEFAULT_RADIUS;

  const rule: IEncodingRule = {
    id: UUID.uuid4(),
    mappings: [
      {
        scale: { scheme: 'constant_rgba', params: { value: fill } },
        channels: ['fill-color', 'circle-fill-color'],
      },
      {
        scale: { scheme: 'constant_rgba', params: { value: stroke } },
        channels: ['stroke-color', 'circle-stroke-color'],
      },
      {
        scale: { scheme: 'constant_num', params: { value: strokeWidth } },
        channels: ['stroke-width', 'circle-stroke-width'],
      },
      {
        scale: { scheme: 'constant_num', params: { value: radius } },
        channels: ['circle-radius'],
      },
    ],
  };

  return { layers: wrapLayer([rule]) };
}

/**
 * Convert a Graduated state to Grammar.
 * The colorRamp scale stores recipe params; grammarToOLStyle computes
 * classification breaks from featureValues at render time.
 */
export function graduatedToGrammar(
  state: SymbologyState,
): IGrammarSymbologyState {
  const field = state.value;
  const fallback = (state.fallbackColor ?? TRANSPARENT) as RGBA;
  const stroke = (state.strokeColor ?? DEFAULT_STROKE) as RGBA;
  const strokeWidth = state.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const radius = state.radius ?? DEFAULT_RADIUS;

  const colorStops = state.stopsOverride
    ?.filter(s => s.value !== undefined && s.color !== undefined)
    .map(s => ({
      stop:
        typeof s.value === 'string' ? parseFloat(s.value) : (s.value as number),
      color: s.color as RGBA,
    }));

  const colorRampScale = {
    scheme: 'colorRamp' as const,
    params: {
      name: state.colorRamp ?? 'viridis',
      ...(state.vmin !== undefined && state.vmax !== undefined
        ? { domain: [state.vmin, state.vmax] as [number, number] }
        : {}),
      nShades: state.nClasses ?? 9,
      mode: state.mode ?? 'equal interval',
      reverse: state.reverseRamp ?? false,
      fallback,
      ...(colorStops && colorStops.length >= 2 ? { colorStops } : {}),
    },
  };

  const fillChannels: IMapping['channels'] = state.strokeFollowsFill
    ? ['fill-color', 'stroke-color', 'circle-fill-color', 'circle-stroke-color']
    : ['fill-color', 'circle-fill-color'];

  const mappings: IMapping[] = [
    { scale: colorRampScale, channels: fillChannels },
  ];

  if (!state.strokeFollowsFill) {
    mappings.push({
      scale: { scheme: 'constant_rgba', params: { value: stroke } },
      channels: ['stroke-color', 'circle-stroke-color'],
    });
  }

  mappings.push(
    {
      scale: { scheme: 'constant_num', params: { value: strokeWidth } },
      channels: ['stroke-width', 'circle-stroke-width'],
    },
    {
      scale: { scheme: 'constant_num', params: { value: radius } },
      channels: ['circle-radius'],
    },
  );

  const rule: IEncodingRule = {
    id: UUID.uuid4(),
    ...(field ? { fields: [field] } : {}),
    mappings: mappings as [IMapping, ...IMapping[]],
  };

  return { layers: wrapLayer([rule]) };
}

/**
 * Convert a Categorized state to Grammar.
 * The categorical scale stores recipe params; grammarToOLStyle enumerates
 * unique values from featureValues at render time.
 */
export function categorizedToGrammar(
  state: SymbologyState,
): IGrammarSymbologyState {
  const field = state.value;
  const fallback = (state.fallbackColor ?? TRANSPARENT) as RGBA;
  const stroke = (state.strokeColor ?? DEFAULT_STROKE) as RGBA;
  const strokeWidth = state.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const radius = state.radius ?? DEFAULT_RADIUS;

  const catColorStops = state.stopsOverride
    ?.filter(s => s.value !== undefined && s.color !== undefined)
    .map(s => ({ stop: s.value as string | number, color: s.color as RGBA }));

  const categoricalScale = {
    scheme: 'categorical' as const,
    params: {
      colorRamp: state.colorRamp ?? 'viridis',
      nShades: state.nClasses,
      reverse: state.reverseRamp ?? false,
      fallback,
      ...(catColorStops && catColorStops.length > 0
        ? { colorStops: catColorStops }
        : {}),
    },
  };

  const fillChannels: IMapping['channels'] = state.strokeFollowsFill
    ? ['fill-color', 'stroke-color', 'circle-fill-color', 'circle-stroke-color']
    : ['fill-color', 'circle-fill-color'];

  const mappings: IMapping[] = [
    { scale: categoricalScale, channels: fillChannels },
  ];

  if (!state.strokeFollowsFill) {
    mappings.push({
      scale: { scheme: 'constant_rgba', params: { value: stroke } },
      channels: ['stroke-color', 'circle-stroke-color'],
    });
  }

  mappings.push(
    {
      scale: { scheme: 'constant_num', params: { value: strokeWidth } },
      channels: ['stroke-width', 'circle-stroke-width'],
    },
    {
      scale: { scheme: 'constant_num', params: { value: radius } },
      channels: ['circle-radius'],
    },
  );

  const rule: IEncodingRule = {
    id: UUID.uuid4(),
    ...(field ? { fields: [field] } : {}),
    mappings: mappings as [IMapping, ...IMapping[]],
  };

  return { layers: wrapLayer([rule]) };
}
