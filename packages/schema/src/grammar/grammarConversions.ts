/**
 * Conversions between existing symbology render types and IGrammarSymbologyState.
 *
 * Pure schema transforms with no OL or UI dependencies, usable both as a
 * schema migration step and when the user switches render types in the dialog.
 */

import { UUID } from '@lumino/coreutils';

import { IVectorLayer } from '../types';
import {
  ClassificationMode,
  IEncodingRule,
  IGrammarSymbologyState,
  IMapping,
  RGBA,
} from './types';

export type SymbologyState = NonNullable<IVectorLayer['symbologyState']>;

const DEFAULT_STROKE_WIDTH = 1.25;
const DEFAULT_FILL: RGBA = [255, 255, 255, 0.4];
const DEFAULT_STROKE: RGBA = [51, 153, 204, 1];
const DEFAULT_RADIUS = 5;
const TRANSPARENT: RGBA = [0, 0, 0, 0];

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
        outputType: 'rgba',
        scale: { scheme: 'constant', value: fill },
        channels: ['fill-color', 'circle-fill-color'],
      },
      {
        outputType: 'rgba',
        scale: { scheme: 'constant', value: stroke },
        channels: ['stroke-color', 'circle-stroke-color'],
      },
      {
        outputType: 'posfloat',
        scale: { scheme: 'constant', value: strokeWidth },
        channels: ['stroke-width', 'circle-stroke-width'],
      },
      {
        outputType: 'posfloat',
        scale: { scheme: 'constant', value: radius },
        channels: ['circle-radius'],
      },
    ],
  };

  return { renderType: 'Grammar', rules: [rule] };
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
    name: state.colorRamp ?? 'viridis',
    ...(state.vmin !== undefined && state.vmax !== undefined
      ? { domain: [state.vmin, state.vmax] as [number, number] }
      : {}),
    nShades: state.nClasses ?? 9,
    mode: (state.mode ?? 'equal interval') as ClassificationMode,
    reverse: state.reverseRamp ?? false,
    fallback,
    ...(colorStops && colorStops.length >= 2 ? { colorStops } : {}),
  };

  const colorChannelMapping: IMapping = {
    outputType: 'rgba',
    scale: colorRampScale,
    channels: ['fill-color', 'circle-fill-color'],
  };

  const strokeMapping: IMapping = state.strokeFollowsFill
    ? {
        outputType: 'rgba',
        scale: colorRampScale,
        channels: ['stroke-color', 'circle-stroke-color'],
      }
    : {
        outputType: 'rgba',
        scale: { scheme: 'constant', value: stroke },
        channels: ['stroke-color', 'circle-stroke-color'],
      };

  const rule: IEncodingRule = {
    id: UUID.uuid4(),
    ...(field ? { field } : {}),
    mappings: [
      colorChannelMapping,
      strokeMapping,
      {
        outputType: 'posfloat',
        scale: { scheme: 'constant', value: strokeWidth },
        channels: ['stroke-width', 'circle-stroke-width'],
      },
      {
        outputType: 'posfloat',
        scale: { scheme: 'constant', value: radius },
        channels: ['circle-radius'],
      },
    ],
  };

  return { renderType: 'Grammar', rules: [rule] };
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
    colorRamp: state.colorRamp ?? 'viridis',
    nShades: state.nClasses,
    reverse: state.reverseRamp ?? false,
    fallback,
    ...(catColorStops && catColorStops.length > 0
      ? { colorStops: catColorStops }
      : {}),
  };

  const colorChannelMapping: IMapping = {
    outputType: 'rgba',
    scale: categoricalScale,
    channels: ['fill-color', 'circle-fill-color'],
  };

  const strokeMapping: IMapping = state.strokeFollowsFill
    ? {
        outputType: 'rgba',
        scale: categoricalScale,
        channels: ['stroke-color', 'circle-stroke-color'],
      }
    : {
        outputType: 'rgba',
        scale: { scheme: 'constant', value: stroke },
        channels: ['stroke-color', 'circle-stroke-color'],
      };

  const rule: IEncodingRule = {
    id: UUID.uuid4(),
    ...(field ? { field } : {}),
    mappings: [
      colorChannelMapping,
      strokeMapping,
      {
        outputType: 'posfloat',
        scale: { scheme: 'constant', value: strokeWidth },
        channels: ['stroke-width', 'circle-stroke-width'],
      },
      {
        outputType: 'posfloat',
        scale: { scheme: 'constant', value: radius },
        channels: ['circle-radius'],
      },
    ],
  };

  return { renderType: 'Grammar', rules: [rule] };
}

// ---------------------------------------------------------------------------
// Reverse conversions: Grammar → old symbology state
// ---------------------------------------------------------------------------

/**
 * Infer which legacy render type best describes a Grammar state.
 * Looks at the scale scheme of the first rule's mappings.
 */
export function inferRenderType(
  grammar: IGrammarSymbologyState,
): 'Single Symbol' | 'Graduated' | 'Categorized' {
  const firstRule = grammar.rules[0];
  if (!firstRule) {
    return 'Single Symbol';
  }
  for (const mapping of firstRule.mappings) {
    if (mapping.scale.scheme === 'colorRamp') {
      return 'Graduated';
    }
    if (mapping.scale.scheme === 'categorical') {
      return 'Categorized';
    }
  }
  return 'Single Symbol';
}

/** Extract Single Symbol panel state from a Grammar state. */
export function grammarToSingleSymbolState(
  grammar: IGrammarSymbologyState,
): SymbologyState {
  const rule = grammar.rules[0];
  let fillColor: RGBA = DEFAULT_FILL;
  let strokeColor: RGBA = DEFAULT_STROKE;
  let strokeWidth = DEFAULT_STROKE_WIDTH;
  let radius = DEFAULT_RADIUS;

  if (rule) {
    for (const mapping of rule.mappings) {
      if (mapping.scale.scheme !== 'constant') {
        continue;
      }
      const { value } = mapping.scale;
      const ch = mapping.channels as string[];
      if (ch.includes('fill-color') || ch.includes('circle-fill-color')) {
        fillColor = value as RGBA;
      } else if (
        ch.includes('stroke-color') ||
        ch.includes('circle-stroke-color')
      ) {
        strokeColor = value as RGBA;
      } else if (
        ch.includes('stroke-width') ||
        ch.includes('circle-stroke-width')
      ) {
        strokeWidth = value as number;
      } else if (ch.includes('circle-radius')) {
        radius = value as number;
      }
    }
  }

  return {
    renderType: 'Single Symbol',
    fillColor,
    strokeColor,
    strokeWidth,
    radius,
  };
}

/** Extract Graduated panel state from a Grammar state. */
export function grammarToGraduatedState(
  grammar: IGrammarSymbologyState,
): SymbologyState {
  const rule = grammar.rules[0];
  let colorRamp = 'viridis';
  let nClasses = 9;
  let mode: ClassificationMode = 'equal interval';
  let reverseRamp = false;
  let fallbackColor: RGBA = TRANSPARENT;
  let vmin: number | undefined;
  let vmax: number | undefined;
  let strokeFollowsFill = false;
  let strokeColor: RGBA = DEFAULT_STROKE;
  let strokeWidth = DEFAULT_STROKE_WIDTH;
  let radius = DEFAULT_RADIUS;
  let value: string | undefined;
  let stopsOverride: SymbologyState['stopsOverride'];

  if (rule) {
    value = rule.field;
    for (const mapping of rule.mappings) {
      const { scale } = mapping;
      const ch = mapping.channels as string[];
      const isFill =
        ch.includes('fill-color') || ch.includes('circle-fill-color');
      const isStroke =
        ch.includes('stroke-color') || ch.includes('circle-stroke-color');
      const isStrokeWidth =
        ch.includes('stroke-width') || ch.includes('circle-stroke-width');
      const isRadius = ch.includes('circle-radius');

      if (scale.scheme === 'colorRamp') {
        if (isFill) {
          colorRamp = scale.name;
          nClasses = scale.nShades;
          mode = scale.mode;
          reverseRamp = scale.reverse;
          fallbackColor = scale.fallback;
          if (scale.domain) {
            [vmin, vmax] = scale.domain;
          }
          if (scale.colorStops && scale.colorStops.length > 0) {
            stopsOverride = scale.colorStops as SymbologyState['stopsOverride'];
          }
        } else if (isStroke) {
          strokeFollowsFill = true;
        }
      } else if (scale.scheme === 'constant') {
        if (isStroke) {
          strokeColor = scale.value as RGBA;
        } else if (isStrokeWidth) {
          strokeWidth = scale.value as number;
        } else if (isRadius) {
          radius = scale.value as number;
        }
      }
    }
  }

  return {
    renderType: 'Graduated',
    value,
    colorRamp,
    nClasses,
    mode,
    reverseRamp,
    fallbackColor,
    strokeFollowsFill,
    strokeColor,
    strokeWidth,
    radius,
    ...(vmin !== undefined ? { vmin } : {}),
    ...(vmax !== undefined ? { vmax } : {}),
    ...(stopsOverride && stopsOverride.length > 0 ? { stopsOverride } : {}),
  };
}

/** Extract Categorized panel state from a Grammar state. */
export function grammarToCategorizedState(
  grammar: IGrammarSymbologyState,
): SymbologyState {
  const rule = grammar.rules[0];
  let colorRamp = 'viridis';
  let nClasses: number | undefined;
  let reverseRamp = false;
  let fallbackColor: RGBA = TRANSPARENT;
  let strokeFollowsFill = false;
  let strokeColor: RGBA = DEFAULT_STROKE;
  let strokeWidth = DEFAULT_STROKE_WIDTH;
  let radius = DEFAULT_RADIUS;
  let value: string | undefined;
  let stopsOverride: SymbologyState['stopsOverride'];

  if (rule) {
    value = rule.field;
    for (const mapping of rule.mappings) {
      const { scale } = mapping;
      const ch = mapping.channels as string[];
      const isFill =
        ch.includes('fill-color') || ch.includes('circle-fill-color');
      const isStroke =
        ch.includes('stroke-color') || ch.includes('circle-stroke-color');
      const isStrokeWidth =
        ch.includes('stroke-width') || ch.includes('circle-stroke-width');
      const isRadius = ch.includes('circle-radius');

      if (scale.scheme === 'categorical') {
        if (isFill) {
          colorRamp = scale.colorRamp;
          nClasses = scale.nShades;
          reverseRamp = scale.reverse ?? false;
          fallbackColor = scale.fallback;
          if (scale.colorStops && scale.colorStops.length > 0) {
            stopsOverride = scale.colorStops as SymbologyState['stopsOverride'];
          }
        } else if (isStroke) {
          strokeFollowsFill = true;
        }
      } else if (scale.scheme === 'constant') {
        if (isStroke) {
          strokeColor = scale.value as RGBA;
        } else if (isStrokeWidth) {
          strokeWidth = scale.value as number;
        } else if (isRadius) {
          radius = scale.value as number;
        }
      }
    }
  }

  return {
    renderType: 'Categorized',
    value,
    colorRamp,
    ...(nClasses !== undefined ? { nClasses } : {}),
    reverseRamp,
    fallbackColor,
    strokeFollowsFill,
    strokeColor,
    strokeWidth,
    radius,
    ...(stopsOverride && stopsOverride.length > 0 ? { stopsOverride } : {}),
  };
}
