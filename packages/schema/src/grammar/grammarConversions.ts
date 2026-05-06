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

  return { renderType: 'Grammar', layers: wrapLayer([rule]) };
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
      mode: (state.mode ?? 'equal interval') as ClassificationMode,
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

  return { renderType: 'Grammar', layers: wrapLayer([rule]) };
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

  return { renderType: 'Grammar', layers: wrapLayer([rule]) };
}

// ---------------------------------------------------------------------------
// Reverse conversions: Grammar → old symbology state
// ---------------------------------------------------------------------------

/**
 * Infer which legacy render type best describes a Grammar state.
 * Looks at the scale scheme of the first rule's mappings in the first layer.
 */
export function inferRenderType(
  grammar: IGrammarSymbologyState,
): 'Single Symbol' | 'Graduated' | 'Categorized' | 'Canonical' {
  const firstRule = grammar.layers[0]?.rules[0];
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
    if (mapping.scale.scheme === 'identity') {
      return 'Canonical';
    }
  }
  return 'Single Symbol';
}

/** Extract Single Symbol panel state from a Grammar state. */
export function grammarToSingleSymbolState(
  grammar: IGrammarSymbologyState,
): SymbologyState {
  let fillColor: RGBA = DEFAULT_FILL;
  let strokeColor: RGBA = DEFAULT_STROKE;
  let strokeWidth = DEFAULT_STROKE_WIDTH;
  let radius = DEFAULT_RADIUS;

  for (const layer of grammar.layers) {
    for (const rule of layer.rules) {
      for (const mapping of rule.mappings) {
        const { scheme } = mapping.scale;
        if (scheme !== 'constant_rgba' && scheme !== 'constant_num') {
          continue;
        }
        const { value } = mapping.scale.params;
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

  for (const layer of grammar.layers) {
    for (const rule of layer.rules) {
      if (!value && rule.fields?.[0]) {
        value = rule.fields[0];
      }
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
            colorRamp = scale.params.name;
            nClasses = scale.params.nShades;
            mode = scale.params.mode;
            reverseRamp = scale.params.reverse;
            fallbackColor = scale.params.fallback;
            if (scale.params.domain) {
              [vmin, vmax] = scale.params.domain;
            }
            if (scale.params.colorStops && scale.params.colorStops.length > 0) {
              stopsOverride = scale.params
                .colorStops as SymbologyState['stopsOverride'];
            }
            if (isStroke) {
              strokeFollowsFill = true;
            }
          } else if (isStroke) {
            strokeFollowsFill = true;
          }
        } else if (
          scale.scheme === 'constant_rgba' ||
          scale.scheme === 'constant_num'
        ) {
          if (isStroke) {
            strokeColor = scale.params.value as RGBA;
          } else if (isStrokeWidth) {
            strokeWidth = scale.params.value as number;
          } else if (isRadius) {
            radius = scale.params.value as number;
          }
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

  for (const layer of grammar.layers) {
    for (const rule of layer.rules) {
      if (!value && rule.fields?.[0]) {
        value = rule.fields[0];
      }
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
            colorRamp = scale.params.colorRamp;
            nClasses = scale.params.nShades;
            reverseRamp = scale.params.reverse ?? false;
            fallbackColor = scale.params.fallback;
            if (scale.params.colorStops && scale.params.colorStops.length > 0) {
              stopsOverride = scale.params
                .colorStops as SymbologyState['stopsOverride'];
            }
            if (isStroke) {
              strokeFollowsFill = true;
            }
          } else if (isStroke) {
            strokeFollowsFill = true;
          }
        } else if (
          scale.scheme === 'constant_rgba' ||
          scale.scheme === 'constant_num'
        ) {
          if (isStroke) {
            strokeColor = scale.params.value as RGBA;
          } else if (isStrokeWidth) {
            strokeWidth = scale.params.value as number;
          } else if (isRadius) {
            radius = scale.params.value as number;
          }
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
