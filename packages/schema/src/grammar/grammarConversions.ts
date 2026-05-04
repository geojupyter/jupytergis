/**
 * Conversions from existing symbology render types → IGrammarSymbologyState.
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

  const categoricalScale = {
    scheme: 'categorical' as const,
    colorRamp: state.colorRamp ?? 'viridis',
    nShades: state.nClasses,
    reverse: state.reverseRamp ?? false,
    fallback,
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
