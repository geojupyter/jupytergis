/**
 * Conversions from existing symbology render types → IGrammarSymbologyState.
 *
 * Each function is a pure schema transform (no model/UI dependencies) so it
 * can be used both when the user switches render types in the dialog and as a
 * schema migration step.
 *
 * Parity guarantee: for each converted state, grammarToOLStyle() should
 * produce an OL expression equivalent to buildVectorFlatStyle() on the same
 * input, which is verified by grammarParity.spec.ts.
 */

import { UUID } from '@lumino/coreutils';

import {
  computeCategorizedColorStops,
  computeGraduatedColorStops,
  DEFAULT_STROKE_WIDTH,
  SymbologyState,
} from '../styleBuilder';
import { IGrammarSymbologyState, IEncodingRule, IMapping, RGBA } from './types';

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
 * @param featureValues  Numeric feature values for the classified field.
 *                       Must be the same values passed to buildVectorFlatStyle
 *                       to guarantee parity.
 */
export function graduatedToGrammar(
  state: SymbologyState,
  featureValues: unknown[],
): IGrammarSymbologyState {
  const field = state.value;
  const fallback = (state.fallbackColor ?? TRANSPARENT) as RGBA;
  const stroke = (state.strokeColor ?? DEFAULT_STROKE) as RGBA;
  const strokeWidth = state.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const radius = state.radius ?? DEFAULT_RADIUS;
  const numericValues = featureValues.filter(Number.isFinite) as number[];

  const computedStops = computeGraduatedColorStops(state, numericValues);
  const colorStops = computedStops.map(s => ({
    stop: s.value as number,
    color: s.color as RGBA,
  }));

  const domainMin =
    state.vmin ?? (numericValues.length > 0 ? Math.min(...numericValues) : 0);
  const domainMax =
    state.vmax ?? (numericValues.length > 0 ? Math.max(...numericValues) : 1);

  const colorRampScale = {
    scheme: 'colorRamp' as const,
    name: state.colorRamp ?? 'viridis',
    domain: [domainMin, domainMax] as [number, number],
    nShades: state.nClasses ?? 9,
    mode: (state.mode ?? 'equal interval') as any,
    reverse: state.reverseRamp ?? false,
    fallback,
    colorStops,
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
 * @param featureValues  All values for the classified field (any primitives).
 */
export function categorizedToGrammar(
  state: SymbologyState,
  featureValues: unknown[],
): IGrammarSymbologyState {
  const field = state.value;
  const fallback = (state.fallbackColor ?? TRANSPARENT) as RGBA;
  const stroke = (state.strokeColor ?? DEFAULT_STROKE) as RGBA;
  const strokeWidth = state.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const radius = state.radius ?? DEFAULT_RADIUS;

  const computedStops = computeCategorizedColorStops(state, featureValues);
  const mapping: Record<string, RGBA> = {};
  for (const stop of computedStops) {
    mapping[String(stop.value)] = stop.color as RGBA;
  }

  const categoricalScale = {
    scheme: 'categorical' as const,
    mapping,
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
